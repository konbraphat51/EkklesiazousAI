// Per-room agent: wires transcript events to routing, admission, delivery, research and the
// participant-facing services (commands, layers, clarifications, dissent, logging).
import { nanoid } from 'nanoid'
import {
  resolveLanguageInsight,
  type AgentState,
  type Clarification,
  type ClarificationAskRequest,
  type DocumentBoard,
  type Insight,
  type InsightLayer,
  type InsightOrigin,
  type InteractionEvent,
  type LanguageInsight,
  type Proactivity,
  type ResearchDepth,
  type ResearchCommandRequest,
  type TranscriptSegment,
  type TriggerPattern,
} from '@ekklesiazous/shared'
import type { Proposal, TriggerOutput } from './AgentSchemas'
import type { AgentToolkit } from './AgentToolkit'
import { ClarificationService } from './ClarificationService'
import { CommandInterpreter } from './CommandInterpreter'
import { ConversationPulse } from './ConversationPulse'
import { DeliveryGate } from './DeliveryGate'
import { DissentService } from './DissentService'
import { EvidenceCollector } from './EvidenceCollector'
import type { EventLog } from './EventLog'
import { InsightHandle } from './InsightHandle'
import { InsightPolicy, RATE_LIMITS_DEFAULT } from './InsightPolicy'
import { InsightResearcher } from './InsightResearcher'
import { IssueMapper, type CritiqueTarget } from './IssueMapper'
import { MeetingContext } from './MeetingContext'
import { TaskLimiter } from './TaskLimiter'
import { computeSimilarity } from './TextSimilarity'
import { TriggerLoop, type ProposalBatch } from './TriggerLoop'

const RESEARCH_CONCURRENCY = 6
const SPOTLIGHT_URGENCY = 0.85
const SPOTLIGHT_MIN_HOLD_MS = 30_000
const HOLD_CLARIFICATION_MS = 3000
const HOLD_DISSENT_MS = 8000
const PRIORITY = { prefetch: 0, proactive: 1, layer: 2, explicit: 3 } as const

/** Everything needed to create one insight. */
interface InsightSpec {
  proposal: Proposal
  origin: InsightOrigin
  pattern: TriggerPattern
  language: LanguageInsight
  topicId: string | null
  issueNodeId: string | null
  segments: TranscriptSegment[]
  interimText: string
  utteranceAt: number
  isSpeculative: boolean
  requesterName: string | null
  depth: ResearchDepth
  gistPreset: string
  detailPreset: { summary: string; bullets: string[] } | null
}

/** Tuning of an agent room. */
export interface AgentRoomOptions {
  /** Per-minute caps on proactive insights, by proactivity. */
  rateLimits: Record<Proactivity, number>
}

/** Result of a dissent submission. */
export type DissentResult = 'posted' | 'rejected' | 'rateLimited'

/** The agent of one meeting room. */
export class AgentRoom {
  private readonly context: MeetingContext
  private readonly policy: InsightPolicy
  private readonly gate: DeliveryGate
  private readonly researcher: InsightResearcher
  private readonly evidence: EvidenceCollector
  private readonly trigger: TriggerLoop
  private readonly pulse: ConversationPulse
  private readonly issueMapper: IssueMapper
  private readonly clarifications: ClarificationService
  private readonly interpreter: CommandInterpreter
  private readonly dissent: DissentService
  private readonly limiter = new TaskLimiter(RESEARCH_CONCURRENCY)
  private readonly handles = new Map<string, InsightHandle>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly nodesCritiqued = new Set<string>()
  private readonly unsubscribe: () => void

  /**
   * @param board - The room's shared board.
   * @param toolkit - Models, search providers and logger.
   * @param eventLog - Research event log of the room.
   * @param options - Tuning.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly toolkit: AgentToolkit,
    private readonly eventLog: EventLog,
    options: AgentRoomOptions = { rateLimits: RATE_LIMITS_DEFAULT },
  ) {
    this.context = new MeetingContext(board)
    this.policy = new InsightPolicy(board, options.rateLimits)
    this.evidence = new EvidenceCollector(toolkit.search)
    this.researcher = new InsightResearcher(
      board,
      this.context,
      toolkit.models,
      this.evidence,
      () => board.readMeta().uxSettings.critiqueFraming,
    )
    this.gate = new DeliveryGate(
      () => board.readMeta().uxSettings.deliveryTiming,
      (handle) => this.handleReleased(handle),
      (handle) => this.eventLog.record('agent', 'shadowed', { insightId: handle.insight.id }),
    )
    this.trigger = new TriggerLoop(
      board,
      this.context,
      toolkit.models.router,
      {
        onProposals: (batch) => this.handleProposals(batch),
        onWakeCommand: (segment, text) => void this.handleWakeCommand(segment, text),
      },
      toolkit.log,
    )
    this.pulse = new ConversationPulse(board, {
      onSegments: (segments) => {
        if (this.isListening()) this.trigger.acceptSegments(segments)
      },
      onCaption: (caption) => {
        if (this.isListening()) this.trigger.acceptCaption(caption)
      },
      onBreakpoint: () => this.gate.notifyBreakpoint(),
    })
    this.issueMapper = new IssueMapper(
      board,
      this.context,
      toolkit.models.deep,
      (targets) => this.handleCritiqueTargets(targets),
      () => this.isListening(),
      toolkit.log,
    )
    this.clarifications = new ClarificationService(
      board,
      this.context,
      toolkit.models,
      toolkit.search,
      (clarification, segments) => this.publishClarification(clarification, segments),
    )
    this.interpreter = new CommandInterpreter(this.context, toolkit.models.router)
    this.dissent = new DissentService(this.context, toolkit.models.writer)
    this.unsubscribe = board.observe((changed, origin) => {
      if (changed.has('insights') && origin === 'participant') this.abortDismissed()
    })
  }

  /**
   * Starts or pauses listening.
   *
   * @param state - New agent state.
   */
  setAgentState(state: AgentState): void {
    const meta = this.board.readMeta()
    this.board.patchMeta(
      {
        agentState: state,
        startedAt: meta.startedAt ?? (state === 'listening' ? Date.now() : null),
      },
      'system',
    )
    if (state !== 'listening') {
      this.gate.flush()
      void this.issueMapper.runIfDue(true)
    }
    this.eventLog.record('agent', 'agentState', { state })
  }

  /**
   * Runs a typed research command.
   *
   * @param request - The command.
   * @param onPrivateSnapshot - Receives snapshots of a private result (required when private).
   * @returns The created insight id, or null when the text is not a research request.
   */
  async issueCommand(
    request: ResearchCommandRequest,
    onPrivateSnapshot?: (insight: Insight) => void,
  ): Promise<string | null> {
    const language = this.languageOfText(request.text)
    const proposal = await this.interpreter.interpret(request.text, language)
    this.eventLog.record('agent', 'command', {
      isPrivate: request.isPrivate,
      depth: request.depth,
      isAccepted: proposal !== null,
    })
    if (!proposal) return null
    const handle = this.createInsight(
      {
        ...this.specFromProposal(proposal, 'command', language),
        requesterName: this.isRequesterShown() ? request.requesterName : null,
        depth: request.depth,
      },
      onPrivateSnapshot ?? null,
    )
    return handle?.insight.id ?? null
  }

  /**
   * Generates a deeper layer of an insight on demand (idempotent).
   *
   * @param insightId - Insight to deepen.
   * @param layer - Layer to generate.
   * @param isPrefetch - Hover prefetch (skipped when the agent is busy).
   */
  requestLayer(insightId: string, layer: InsightLayer, isPrefetch: boolean): boolean {
    const insight = this.board.getInsight(insightId)
    if (!insight) return false
    const status = layer === 'detail' ? insight.detailStatus : insight.deepStatus
    if (status === 'running' || status === 'ready') return true
    if (isPrefetch && (!this.limiter.hasFreeSlot || layer === 'deep')) return false
    const handle = this.handles.get(insightId) ?? InsightHandle.adopt(this.board, insight)
    this.handles.set(insightId, handle)
    const signal = this.controllerOf(insightId).signal
    const timings = handle.insight.timings
    const requestedAt = Date.now()
    handle.patch(
      layer === 'detail'
        ? { detailStatus: 'running', timings: { ...timings, detailRequestedAt: requestedAt } }
        : { deepStatus: 'running', timings: { ...timings, deepRequestedAt: requestedAt } },
    )
    this.eventLog.record('agent', 'layerRequested', { insightId, layer, isPrefetch })
    void this.limiter
      .run(
        () => this.runLayer(handle, layer, signal),
        isPrefetch ? PRIORITY.prefetch : PRIORITY.layer,
      )
      .catch((error: unknown) =>
        this.toolkit.log.warn({ error: String(error), insightId, layer }, 'layer failed'),
      )
    return true
  }

  /**
   * Answers a private clarification or recap request.
   *
   * @param request - The request.
   * @param onSnapshot - Receives streamed snapshots.
   * @param signal - Cancels when the requester disconnects.
   */
  askClarification(
    request: ClarificationAskRequest,
    onSnapshot: (clarification: Clarification) => void,
    signal: AbortSignal,
  ): Promise<Clarification> {
    this.eventLog.record('agent', 'clarification', {
      mode: request.mode,
      segmentCount: request.segmentIds.length,
      hasSelection: request.selectedText !== null,
    })
    return this.clarifications.ask(request, onSnapshot, signal)
  }

  /**
   * Shares a clarification anonymously on the board.
   *
   * @param clarificationId - Clarification to share.
   */
  shareClarification(clarificationId: string): string | null {
    return this.clarifications.share(clarificationId)
  }

  /**
   * Voices an anonymous concern as an agent critique.
   *
   * @param text - The concern.
   * @param participantId - Pseudonymous id for rate limiting.
   */
  async raiseDissent(text: string, participantId: string): Promise<DissentResult> {
    const meta = this.board.readMeta()
    const language = this.languageOfText(text)
    const output = await this.dissent.rewrite(
      text,
      participantId,
      language,
      meta.uxSettings.critiqueFraming,
    )
    if (!output) return 'rateLimited'
    this.eventLog.record('agent', 'dissent', { isAppropriate: output.isAppropriate })
    if (!output.isAppropriate) return 'rejected'
    this.createInsight(
      {
        ...this.specFromProposal(
          {
            kind: 'critique',
            pattern: 'untestedAssumption',
            title: output.title,
            query: output.query,
            queryAlternate: '',
            term: '',
            urgency: 0.8,
            reason: '',
            segmentIds: [],
            depth: 'default',
          },
          'proxyDissent',
          language,
        ),
        pattern: 'dissent',
        gistPreset: output.gist,
      },
      null,
    )
    return 'posted'
  }

  /**
   * Stores participant interaction events in the research log.
   *
   * @param events - Events from one client batch.
   */
  recordClientEvents(events: InteractionEvent[]): void {
    for (const event of events.slice(0, 500)) this.eventLog.record('client', event.type, event)
  }

  /** Stops all background work. */
  dispose(): void {
    this.unsubscribe()
    this.pulse.dispose()
    this.trigger.dispose()
    this.issueMapper.dispose()
    this.gate.dispose()
    for (const controller of this.controllers.values()) controller.abort()
    void this.eventLog.dispose()
  }

  private isListening(): boolean {
    return this.board.readMeta().agentState === 'listening'
  }

  private isRequesterShown(): boolean {
    return this.board.readMeta().uxSettings.requesterIdentity === 'shown'
  }

  private languageOfText(text: string): LanguageInsight {
    const spoken = /[぀-ヿ㐀-鿿]/.test(text) ? 'ja' : 'en'
    return resolveLanguageInsight(this.board.readMeta().languageInsight, spoken)
  }

  private handleProposals(batch: ProposalBatch): void {
    this.eventLog.record('agent', 'router', {
      routerMs: batch.routerMs,
      isSpeculative: batch.interimText.length > 0,
      segmentIds: batch.segments.map((segment) => segment.id),
      proposals: batch.proposals.map((proposal) => ({
        kind: proposal.kind,
        pattern: proposal.pattern,
        urgency: proposal.urgency,
        title: proposal.title,
      })),
    })
    const topicId = this.resolveTopic(batch.topic)
    for (const proposal of batch.proposals) {
      const segments = this.context.findSegments(proposal.segmentIds)
      const origin: InsightOrigin = proposal.pattern === 'explicitRequest' ? 'command' : 'proactive'
      this.createInsight(
        {
          ...this.specFromProposal(proposal, origin, batch.language),
          topicId,
          segments: segments.length > 0 ? segments : batch.segments,
          interimText: batch.interimText,
          utteranceAt: batch.utteranceAt,
          isSpeculative: batch.interimText.length > 0,
          requesterName:
            origin === 'command' && this.isRequesterShown()
              ? this.speakerLabelOf(batch.segments.at(-1)?.speakerId)
              : null,
        },
        null,
      )
    }
  }

  private async handleWakeCommand(segment: TranscriptSegment, text: string): Promise<void> {
    try {
      const language = resolveLanguageInsight(
        this.board.readMeta().languageInsight,
        segment.language,
      )
      const proposal = await this.interpreter.interpret(text, language)
      if (!proposal) return
      this.createInsight(
        {
          ...this.specFromProposal(proposal, 'command', language),
          segments: [segment],
          utteranceAt: segment.finalizedAt,
          requesterName: this.isRequesterShown() ? this.speakerLabelOf(segment.speakerId) : null,
        },
        null,
      )
    } catch (error) {
      this.toolkit.log.warn({ error: String(error) }, 'wake command failed')
    }
  }

  private handleCritiqueTargets(targets: CritiqueTarget[]): void {
    for (const target of targets) {
      if (this.nodesCritiqued.has(target.node.id)) continue
      this.nodesCritiqued.add(target.node.id)
      const language = this.languageOfText(target.node.text)
      this.createInsight(
        {
          ...this.specFromProposal(
            {
              kind: 'critique',
              pattern: 'quickAgreement',
              title: target.concern,
              query: `${target.node.text} risks limitations evidence`,
              queryAlternate: '',
              term: '',
              urgency: 0.7,
              reason: target.concern,
              segmentIds: [],
              depth: 'default',
            },
            'proactive',
            language,
          ),
          topicId: target.node.topicId,
          issueNodeId: target.node.id,
        },
        null,
      )
    }
  }

  private publishClarification(
    clarification: Clarification,
    segments: TranscriptSegment[],
  ): string {
    const terms = clarification.terms.map((term) => `${term.term}: ${term.explanation}`)
    const handle = this.createInsight(
      {
        ...this.specFromProposal(
          {
            kind: 'catchUp',
            pattern: 'unfamiliarTerm',
            title: clarification.terms[0]?.term ?? clarification.quote.slice(0, 40),
            query: clarification.terms.map((term) => term.term).join(' ') || clarification.quote,
            queryAlternate: '',
            term: '',
            urgency: 0.7,
            reason: '',
            segmentIds: segments.map((segment) => segment.id),
            depth: 'default',
          },
          'clarification',
          clarification.language,
        ),
        pattern: 'confusion',
        segments,
        gistPreset: clarification.rephrase,
        detailPreset: { summary: clarification.background, bullets: terms },
      },
      null,
    )
    return handle?.insight.id ?? ''
  }

  private specFromProposal(
    proposal: Proposal,
    origin: InsightOrigin,
    language: LanguageInsight,
  ): InsightSpec {
    const meta = this.board.readMeta()
    const depth: ResearchDepth =
      proposal.depth !== 'default'
        ? proposal.depth
        : origin === 'proactive'
          ? meta.researchDepthDefault
          : 'standard'
    return {
      proposal,
      origin,
      pattern: proposal.pattern,
      language,
      topicId: null,
      issueNodeId: null,
      segments: this.context.findSegments(proposal.segmentIds),
      interimText: '',
      utteranceAt: Date.now(),
      isSpeculative: false,
      requesterName: null,
      depth,
      gistPreset: '',
      detailPreset: null,
    }
  }

  private createInsight(
    spec: InsightSpec,
    onPrivateSnapshot: ((insight: Insight) => void) | null,
  ): InsightHandle | null {
    const { proposal } = spec
    const isPrivate = onPrivateSnapshot !== null
    if (!isPrivate) {
      const verdict = this.policy.admit({
        kind: proposal.kind,
        title: proposal.title,
        query: proposal.query,
        term: proposal.term,
        urgency: proposal.urgency,
        origin: spec.origin,
      })
      if (!verdict.isAdmitted) {
        this.eventLog.record('agent', 'suppressed', {
          reason: verdict.reason,
          kind: proposal.kind,
          title: proposal.title,
          urgency: proposal.urgency,
        })
        return null
      }
    }

    const now = Date.now()
    const insight: Insight = {
      id: nanoid(12),
      kind: proposal.kind,
      status: 'researching',
      topicId: spec.topicId,
      issueNodeId: spec.issueNodeId,
      triggerPattern: spec.pattern,
      title: proposal.title,
      gist: spec.gistPreset,
      detailStatus: spec.detailPreset ? 'ready' : 'none',
      summary: spec.detailPreset?.summary ?? '',
      bullets: spec.detailPreset?.bullets ?? [],
      deepStatus: 'none',
      sections: [],
      sources: [],
      verdict: null,
      urgency: Math.min(1, Math.max(0, proposal.urgency)),
      confidence: 0.5,
      language: spec.language,
      query: proposal.query,
      origin: spec.origin,
      depth: spec.depth,
      progressNote: 'searching:1',
      requesterName: spec.requesterName,
      reason: proposal.reason,
      triggerSegmentIds: spec.segments.map((segment) => segment.id),
      triggerQuote: (spec.interimText || this.context.quote(spec.segments)).slice(0, 280),
      createdAt: now,
      updatedAt: now,
      timings: {
        utteranceAt: spec.utteranceAt,
        triggeredAt: now,
        firstContentAt: spec.gistPreset ? now : null,
        readyAt: null,
        releasedAt: null,
        detailRequestedAt: null,
        detailReadyAt: spec.detailPreset ? now : null,
        deepRequestedAt: null,
        deepReadyAt: null,
        isSpeculative: spec.isSpeculative,
      },
      isPinned: false,
      votes: {},
    }
    const handle = new InsightHandle(this.board, insight)
    if (isPrivate) {
      handle.onChange = onPrivateSnapshot
      onPrivateSnapshot(insight)
    } else {
      this.handles.set(insight.id, handle)
      const minimumHoldMs =
        spec.origin === 'proxyDissent'
          ? HOLD_DISSENT_MS
          : spec.origin === 'clarification'
            ? HOLD_CLARIFICATION_MS
            : 0
      this.gate.submit(handle, { isImmediate: spec.origin === 'command', minimumHoldMs })
    }
    this.eventLog.record('agent', 'created', {
      insightId: insight.id,
      kind: insight.kind,
      origin: insight.origin,
      pattern: insight.triggerPattern,
      depth: insight.depth,
      isPrivate,
      isSpeculative: spec.isSpeculative,
    })
    this.startResearch(handle, spec, isPrivate)
    return handle
  }

  private startResearch(handle: InsightHandle, spec: InsightSpec, isPrivate: boolean): void {
    const id = handle.insight.id
    const signal = this.controllerOf(id).signal
    const priority = spec.origin === 'proactive' ? PRIORITY.proactive : PRIORITY.explicit
    void this.limiter
      .run(async () => {
        await this.researcher.writeGist(
          handle,
          {
            kind: spec.proposal.kind,
            depth: spec.depth,
            query: spec.proposal.query,
            queryAlternate: spec.proposal.queryAlternate,
            term: spec.proposal.term,
            queriesPlanned: [],
          },
          signal,
        )
        this.eventLog.record('agent', 'gistReady', {
          insightId: id,
          timings: handle.insight.timings,
        })
        // deeper layers run up front only when the depth asks for them (or for private results)
        if (spec.depth !== 'quick' || isPrivate) {
          if (handle.insight.detailStatus === 'none') await this.runLayer(handle, 'detail', signal)
        }
        if (spec.depth === 'deep') await this.runLayer(handle, 'deep', signal)
      }, priority)
      .catch((error: unknown) => {
        if (signal.aborted) return
        handle.patch({ status: 'failed', progressNote: '' })
        this.toolkit.log.warn({ error: String(error), insightId: id }, 'research failed')
      })
  }

  private async runLayer(
    handle: InsightHandle,
    layer: InsightLayer,
    signal: AbortSignal,
  ): Promise<void> {
    if (layer === 'detail') {
      await this.researcher.writeDetail(handle, signal)
      handle.patch({ timings: { ...handle.insight.timings, detailReadyAt: Date.now() } })
    } else {
      await this.researcher.writeDeep(handle, signal)
      handle.patch({ timings: { ...handle.insight.timings, deepReadyAt: Date.now() } })
    }
    this.eventLog.record('agent', 'layerReady', { insightId: handle.insight.id, layer })
  }

  private handleReleased(handle: InsightHandle): void {
    const now = Date.now()
    const insight = handle.insight
    handle.patch({ timings: { ...insight.timings, releasedAt: now } })
    this.eventLog.record('agent', 'released', {
      insightId: insight.id,
      latencyMs: now - insight.timings.utteranceAt,
    })

    const meta = this.board.readMeta()
    const isSpotlightFree =
      !meta.spotlightInsightId || now - (meta.spotlightAt ?? 0) >= SPOTLIGHT_MIN_HOLD_MS
    if (
      meta.uxSettings.spotlight === 'auto' &&
      insight.urgency >= SPOTLIGHT_URGENCY &&
      isSpotlightFree
    ) {
      this.board.patchMeta({ spotlightInsightId: insight.id, spotlightAt: now }, 'agent')
    }
  }

  private resolveTopic(topic: TriggerOutput['topic']): string | null {
    const topics = this.board.listTopics()
    const now = Date.now()
    const existing =
      topics.find((candidate) => candidate.id === topic.existingTopicId) ??
      (topic.label
        ? topics.find((candidate) => computeSimilarity(candidate.label, topic.label) >= 0.6)
        : undefined)
    if (existing) {
      this.board.upsertTopic({ ...existing, lastActiveAt: now })
      return existing.id
    }
    if (!topic.label.trim()) return null
    const id = nanoid(8)
    this.board.upsertTopic({ id, label: topic.label.trim(), createdAt: now, lastActiveAt: now })
    return id
  }

  private speakerLabelOf(speakerId: string | undefined): string | null {
    if (!speakerId) return null
    return this.board.listSpeakers().find((speaker) => speaker.id === speakerId)?.label ?? null
  }

  private controllerOf(insightId: string): AbortController {
    const existing = this.controllers.get(insightId)
    if (existing) return existing
    const controller = new AbortController()
    this.controllers.set(insightId, controller)
    return controller
  }

  private abortDismissed(): void {
    for (const [id, handle] of this.handles) {
      if (!handle.isDismissed) continue
      this.controllers.get(id)?.abort()
      this.controllers.delete(id)
      this.handles.delete(id)
    }
  }
}

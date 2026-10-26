// Periodically rebuilds the IBIS issue map and the rolling summary with the deep model, and flags
// ideas that the group adopts without scrutiny (groupthink targets for critiques).
import { nanoid } from 'nanoid'
import type { DocumentBoard, IssueNode } from '@ekklesiazous/shared'
import type { LanguageModel } from '../Llm/LanguageModel'
import { issueMapSchema, type IssueMapOutput } from './AgentSchemas'
import type { AgentLogger } from './AgentToolkit'
import type { MeetingContext } from './MeetingContext'
import { PROMPT_ISSUE_MAP_SYSTEM, buildPromptIssueMapInstruction } from './Prompts/PromptIssueMap'
import { computeSimilarity } from './TextSimilarity'

const CHECK_INTERVAL_MS = 5000
const MIN_INTERVAL_MS = 40_000
const MIN_NEW_SEGMENTS = 3

/** An idea the mapper wants challenged. */
export interface CritiqueTarget {
  /** Issue node id on the board. */
  node: IssueNode
  /** Concern to raise. */
  concern: string
}

/** Maintains the issue map. */
export class IssueMapper {
  private readonly timer: NodeJS.Timeout
  private segmentCountMapped = 0
  private lastRunAt = 0
  private isRunning = false

  /**
   * @param board - Board to read and write.
   * @param context - Prompt context builder.
   * @param model - Deep model.
   * @param onCritiqueTargets - Receives ideas that need a devil's advocate.
   * @param isActive - Whether the agent is listening.
   * @param log - Logger.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly context: MeetingContext,
    private readonly model: LanguageModel,
    private readonly onCritiqueTargets: (targets: CritiqueTarget[]) => void,
    private readonly isActive: () => boolean,
    private readonly log: AgentLogger,
  ) {
    this.timer = setInterval(() => void this.runIfDue(), CHECK_INTERVAL_MS)
  }

  /** Stops the periodic check. */
  dispose(): void {
    clearInterval(this.timer)
  }

  /** Runs now if enough new speech arrived (also used when the meeting pauses). */
  async runIfDue(isForced = false): Promise<void> {
    const segmentCount = this.board.listSegments().length
    const isDue =
      segmentCount - this.segmentCountMapped >= MIN_NEW_SEGMENTS &&
      Date.now() - this.lastRunAt >= MIN_INTERVAL_MS
    if (this.isRunning || !(isForced || (isDue && this.isActive()))) return
    if (segmentCount === this.segmentCountMapped) return
    this.isRunning = true
    this.lastRunAt = Date.now()
    const startedAt = Date.now()
    try {
      const transcript = this.context.renderTranscript()
      const output = await this.model.generate<IssueMapOutput>({
        task: 'issueMap',
        hints: {
          segmentCount: String(segmentCount),
          insights: JSON.stringify(
            this.board.listInsights().map((insight) => ({ id: insight.id, title: insight.title })),
          ),
        },
        prompt: {
          system: PROMPT_ISSUE_MAP_SYSTEM,
          contextBlocks: [...transcript.blocks, this.context.renderState()],
          cacheIndex: transcript.cacheIndex,
          instruction: buildPromptIssueMapInstruction(this.renderCurrentMap()),
        },
        schema: issueMapSchema,
        maxTokens: 8000,
      })
      this.segmentCountMapped = segmentCount
      this.apply(output)
      this.log.info(
        { elapsedMs: Date.now() - startedAt, nodes: output.nodes.length },
        'issue map updated',
      )
    } catch (error) {
      this.log.warn({ error: String(error) }, 'issue map update failed')
    } finally {
      this.isRunning = false
    }
  }

  private renderCurrentMap(): string {
    return this.board
      .listIssues()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(
        (node) =>
          `[${node.id}] ${node.type} parent=${node.parentId ?? '-'} topic=${node.topicId ?? '-'}${node.isHumanEdited ? ' LOCKED' : ''}: ${node.text}`,
      )
      .join('\n')
  }

  private apply(output: IssueMapOutput): void {
    const now = Date.now()
    const topicIds = this.applyTopics(output.topics, now)
    const existing = new Map(this.board.listIssues().map((node) => [node.id, node]))
    const nodeIds = new Map<string, string>()
    for (const node of output.nodes) {
      nodeIds.set(node.id, existing.has(node.id) ? node.id : nanoid(10))
    }

    const kept = new Set<string>()
    for (const node of output.nodes) {
      const id = nodeIds.get(node.id)!
      kept.add(id)
      const previous = existing.get(id)
      if (previous?.isHumanEdited) continue
      this.board.upsertIssue({
        id,
        type: node.type,
        text: node.text,
        parentId: node.parentId ? (nodeIds.get(node.parentId) ?? null) : null,
        topicId: topicIds.get(node.topicId) ?? null,
        speakerIds: node.speakerIds,
        isRaisedByAgent: previous?.isRaisedByAgent ?? true,
        isHumanEdited: false,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      })
    }
    // the agent only removes nodes it owns; participant nodes stay
    for (const node of existing.values()) {
      if (!kept.has(node.id) && node.isRaisedByAgent && !node.isHumanEdited) {
        this.board.removeIssue(node.id)
      }
    }

    const insightIds = new Set(this.board.listInsights().map((insight) => insight.id))
    for (const link of output.insightLinks) {
      const nodeId = nodeIds.get(link.nodeId) ?? (existing.has(link.nodeId) ? link.nodeId : null)
      if (nodeId && insightIds.has(link.insightId)) {
        this.board.patchInsight(link.insightId, { issueNodeId: nodeId })
      }
    }

    this.board.patchMeta({ summary: output.summary, summaryUpdatedAt: now }, 'agent')

    const issues = new Map(this.board.listIssues().map((node) => [node.id, node]))
    const targets = output.critiqueTargets.flatMap((target) => {
      const node = issues.get(nodeIds.get(target.nodeId) ?? target.nodeId)
      return node && node.type === 'idea' ? [{ node, concern: target.concern }] : []
    })
    if (targets.length > 0) this.onCritiqueTargets(targets)
  }

  private applyTopics(topics: IssueMapOutput['topics'], now: number): Map<string, string> {
    const existing = this.board.listTopics()
    const ids = new Map<string, string>()
    for (const topic of topics) {
      const byId = existing.find((candidate) => candidate.id === topic.id)
      const byLabel = existing.find(
        (candidate) => computeSimilarity(candidate.label, topic.label) >= 0.6,
      )
      const match = byId ?? byLabel
      if (match) {
        ids.set(topic.id, match.id)
        continue
      }
      const id = nanoid(8)
      this.board.upsertTopic({ id, label: topic.label, createdAt: now, lastActiveAt: now })
      ids.set(topic.id, id)
    }
    return ids
  }
}

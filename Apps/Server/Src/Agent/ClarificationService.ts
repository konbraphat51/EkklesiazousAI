// Private, anonymous clarifications and recaps; promotes moments several people flagged to a public
// catch-up card without revealing who asked.
import { nanoid } from 'nanoid'
import type {
  Clarification,
  ClarificationAskRequest,
  DocumentBoard,
  TranscriptSegment,
} from '@ekklesiazous/shared'
import { raceSearches } from '../Search/SearchFanOut'
import type { SearchHit } from '../Search/SearchProvider'
import { clarificationSchema, type ClarificationOutput } from './AgentSchemas'
import type { AgentModels, AgentSearch } from './AgentToolkit'
import { detectQueryLanguage } from './EvidenceCollector'
import type { MeetingContext } from './MeetingContext'
import {
  PROMPT_CLARIFICATION_SYSTEM,
  buildPromptClarificationInstruction,
} from './Prompts/PromptClarification'
import { renderSources } from './Prompts/PromptWriter'

const LOOKBACK_MS = 20_000
const PROMOTION_PARTICIPANTS = 2
const LOOKUP_DEADLINE_MS = 1200
const STORE_LIMIT = 200

/** A clarification kept for sharing, with the segments it explains. */
interface ClarificationStored {
  clarification: Clarification
  segments: TranscriptSegment[]
}

/** Callback that publishes a clarification as an anonymous public catch-up insight. */
export type ClarificationPublisher = (
  clarification: Clarification,
  segments: TranscriptSegment[],
) => string

/** Handles private clarification and recap requests. */
export class ClarificationService {
  private readonly stored = new Map<string, ClarificationStored>()
  private readonly flaggers = new Map<string, Set<string>>()
  private readonly segmentsPromoted = new Set<string>()

  /**
   * @param board - Board (confusion counts, settings).
   * @param context - Transcript access.
   * @param models - Writer model.
   * @param search - Encyclopedia lookups for highlighted terms.
   * @param publish - Publishes an anonymous public card; returns the insight id.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly context: MeetingContext,
    private readonly models: AgentModels,
    private readonly search: AgentSearch,
    private readonly publish: ClarificationPublisher,
  ) {}

  /**
   * Answers one private request, streaming snapshots.
   *
   * @param request - The request.
   * @param onSnapshot - Receives each snapshot (sent only to the requester).
   * @param signal - Cancels the work when the requester disconnects.
   */
  async ask(
    request: ClarificationAskRequest,
    onSnapshot: (clarification: Clarification) => void,
    signal: AbortSignal,
  ): Promise<Clarification> {
    const now = Date.now()
    const isRecap = request.mode === 'recap'
    const segments = isRecap
      ? this.context.findSegmentsRecent(request.recapMinutes * 60_000, now)
      : request.segmentIds.length > 0
        ? this.context.findSegments(request.segmentIds)
        : this.context.findSegmentsRecent(LOOKBACK_MS, now)
    const captions = isRecap
      ? ''
      : this.board
          .listCaptions()
          .map((caption) => caption.text)
          .join(' ')
    const quote = isRecap
      ? segments.map((segment) => `${segment.speakerId}: ${segment.text}`).join('\n')
      : [this.context.quote(segments), captions].filter(Boolean).join(' ')

    let clarification: Clarification = {
      id: nanoid(12),
      status: 'writing',
      quote: isRecap ? '' : quote,
      rephrase: '',
      terms: [],
      background: '',
      sources: [],
      language: request.language,
      createdAt: now,
      firstContentAt: null,
    }
    onSnapshot(clarification)
    if (!isRecap) this.recordFlags(request.participantId, segments)

    const hits = request.selectedText ? await this.lookUp(request.selectedText, signal) : []
    try {
      const output = await this.models.writer.generate<ClarificationOutput>({
        task: isRecap ? 'recap' : 'clarification',
        hints: { quote: quote.slice(0, 200), selectedText: request.selectedText ?? '' },
        prompt: {
          system: PROMPT_CLARIFICATION_SYSTEM,
          contextBlocks: [this.context.renderRecent(isRecap ? 8 : 16), renderSources(hits)],
          cacheIndex: -1,
          instruction: buildPromptClarificationInstruction({
            mode: request.mode,
            language: request.language === 'ja' ? 'Japanese' : 'English',
            quote: quote || '(silence)',
            selectedText: request.selectedText,
            background: request.background.slice(0, 300),
            recapMinutes: request.recapMinutes,
          }),
        },
        schema: clarificationSchema,
        maxTokens: 1200,
        signal,
        onPartial: (partial) => {
          clarification = mergePartial(clarification, partial)
          onSnapshot(clarification)
        },
      })
      clarification = {
        ...clarification,
        status: 'ready',
        rephrase: output.rephrase,
        terms: output.terms,
        background: output.background,
        sources: output.sourceIndices
          .filter((index) => hits[index])
          .map((index) => stripHit(hits[index]!)),
        firstContentAt: clarification.firstContentAt ?? Date.now(),
      }
    } catch {
      clarification = { ...clarification, status: 'failed' }
    }
    onSnapshot(clarification)
    this.remember(clarification, segments)
    if (!isRecap && clarification.status === 'ready') this.promoteIfShared(clarification, segments)
    return clarification
  }

  /**
   * Publishes a clarification the requester chose to share (anonymously).
   *
   * @param clarificationId - Clarification to share.
   * @returns The new insight id, or null if unknown.
   */
  share(clarificationId: string): string | null {
    const stored = this.stored.get(clarificationId)
    if (!stored || stored.clarification.status !== 'ready') return null
    return this.publish(stored.clarification, stored.segments)
  }

  private recordFlags(participantId: string, segments: TranscriptSegment[]): void {
    for (const segment of segments) {
      const participants = this.flaggers.get(segment.id) ?? new Set<string>()
      if (participants.has(participantId)) continue
      participants.add(participantId)
      this.flaggers.set(segment.id, participants)
      this.board.incrementConfusion(segment.id)
    }
  }

  private promoteIfShared(clarification: Clarification, segments: TranscriptSegment[]): void {
    if (!this.board.readMeta().isClarificationPromotionEnabled) return
    const isShared = segments.some(
      (segment) =>
        !this.segmentsPromoted.has(segment.id) &&
        (this.flaggers.get(segment.id)?.size ?? 0) >= PROMOTION_PARTICIPANTS,
    )
    if (!isShared) return
    for (const segment of segments) this.segmentsPromoted.add(segment.id)
    this.publish(clarification, segments)
  }

  private async lookUp(text: string, signal: AbortSignal): Promise<SearchHit[]> {
    const provider = this.search.encyclopedia
    if (!provider) return []
    const result = await raceSearches(
      [
        {
          provider,
          query: { text, language: detectQueryLanguage(text), maxResults: 2, mode: 'fast' },
        },
      ],
      LOOKUP_DEADLINE_MS,
      signal,
    )
    return result.hits
  }

  private remember(clarification: Clarification, segments: TranscriptSegment[]): void {
    this.stored.set(clarification.id, { clarification, segments })
    if (this.stored.size > STORE_LIMIT) {
      const oldest = this.stored.keys().next().value
      if (oldest) this.stored.delete(oldest)
    }
  }
}

function mergePartial(clarification: Clarification, partial: unknown): Clarification {
  if (partial === null || typeof partial !== 'object') return clarification
  const value = partial as Partial<ClarificationOutput>
  const rephrase = typeof value.rephrase === 'string' ? value.rephrase : clarification.rephrase
  return {
    ...clarification,
    rephrase,
    terms: Array.isArray(value.terms)
      ? value.terms.filter((term) => typeof term?.term === 'string')
      : clarification.terms,
    background: typeof value.background === 'string' ? value.background : clarification.background,
    firstContentAt: clarification.firstContentAt ?? (rephrase ? Date.now() : null),
  }
}

function stripHit(hit: SearchHit): Clarification['sources'][number] {
  return {
    title: hit.title,
    url: hit.url,
    snippet: hit.snippet,
    publisher: hit.publisher,
    year: hit.year,
    category: hit.category,
  }
}

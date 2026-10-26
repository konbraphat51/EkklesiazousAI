// Schedules router calls on new speech: debounced batches of final utterances, speculative calls on
// interim speech, and immediate hand-off of wake-word commands.
import {
  getUrgencyThreshold,
  resolveLanguageInsight,
  type CaptionLive,
  type DocumentBoard,
  type LanguageInsight,
  type TranscriptSegment,
} from '@ekklesiazous/shared'
import type { LanguageModel } from '../Llm/LanguageModel'
import { triggerSchema, type Proposal, type TriggerOutput } from './AgentSchemas'
import type { AgentLogger } from './AgentToolkit'
import type { MeetingContext } from './MeetingContext'
import { PROMPT_TRIGGER_SYSTEM, buildPromptTriggerInstruction } from './Prompts/PromptTrigger'
import { normalizeText } from './TextSimilarity'

const DEBOUNCE_MS = 150
const SPECULATIVE_GROWTH_CHARACTERS = 30
const SPECULATIVE_MIN_INTERVAL_MS = 1500
const SPECULATIVE_MIN_CHARACTERS = 24

/** Context of a batch of proposals. */
export interface ProposalBatch {
  /** Proposals of the router. */
  proposals: Proposal[]
  /** Topic of the analyzed speech. */
  topic: TriggerOutput['topic']
  /** Language the insights should be written in. */
  language: LanguageInsight
  /** Segments analyzed (empty for speculative calls). */
  segments: TranscriptSegment[]
  /** Interim text analyzed speculatively, or ''. */
  interimText: string
  /** When the analyzed speech was observed (epoch ms). */
  utteranceAt: number
  /** Router latency in milliseconds. */
  routerMs: number
}

/** Receivers of the loop's results. */
export interface TriggerLoopListener {
  /** Router produced (possibly empty) proposals. */
  onProposals(batch: ProposalBatch): void
  /** A segment addressed the agent by wake word. */
  onWakeCommand(segment: TranscriptSegment, commandText: string): void
}

/** Drives the router. */
export class TriggerLoop {
  private segmentsPending: TranscriptSegment[] = []
  private isRunning = false
  private isRerunWanted = false
  private debounceTimer: NodeJS.Timeout | null = null
  private lastRunAt = 0
  private readonly speculativeLengths = new Map<string, number>()

  /**
   * @param board - Board with settings.
   * @param context - Prompt context builder.
   * @param router - Fast model.
   * @param listener - Receives proposals and commands.
   * @param log - Logger.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly context: MeetingContext,
    private readonly router: LanguageModel,
    private readonly listener: TriggerLoopListener,
    private readonly log: AgentLogger,
  ) {}

  /**
   * Queues new final segments.
   *
   * @param segments - Newly finalized segments.
   */
  acceptSegments(segments: TranscriptSegment[]): void {
    const wakeWords = this.board.readMeta().wakeWords.map(normalizeText).filter(Boolean)
    for (const segment of segments) {
      this.speculativeLengths.delete(segment.sourceId)
      const command = extractCommand(segment.text, wakeWords)
      if (command !== null) this.listener.onWakeCommand(segment, command)
      else this.segmentsPending.push(segment)
    }
    if (this.segmentsPending.length === 0) return
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.run(null), DEBOUNCE_MS)
  }

  /**
   * Considers a speculative router call on growing interim speech.
   *
   * @param caption - Live caption of one stream.
   */
  acceptCaption(caption: CaptionLive): void {
    const lengthSeen = this.speculativeLengths.get(caption.sourceId) ?? 0
    const isGrownEnough = caption.text.length - lengthSeen >= SPECULATIVE_GROWTH_CHARACTERS
    const isSpaced = Date.now() - this.lastRunAt >= SPECULATIVE_MIN_INTERVAL_MS
    if (caption.text.length < lengthSeen) this.speculativeLengths.set(caption.sourceId, 0)
    if (this.isRunning || !isGrownEnough || !isSpaced) return
    if (caption.text.length < SPECULATIVE_MIN_CHARACTERS) return
    this.speculativeLengths.set(caption.sourceId, caption.text.length)
    void this.run(caption)
  }

  /** Cancels pending work. */
  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
  }

  private async run(caption: CaptionLive | null): Promise<void> {
    if (this.isRunning) {
      if (!caption) this.isRerunWanted = true
      return
    }
    const segments = caption ? [] : this.segmentsPending.splice(0)
    if (!caption && segments.length === 0) return
    this.isRunning = true
    this.lastRunAt = Date.now()
    const startedAt = Date.now()
    try {
      const meta = this.board.readMeta()
      const languageSpoken = caption?.language ?? segments.at(-1)?.language ?? 'en'
      const language = resolveLanguageInsight(meta.languageInsight, languageSpoken)
      const transcript = this.context.renderTranscript()
      const output = await this.router.generate({
        task: 'trigger',
        hints: {
          segmentTexts: segments.map((segment) => segment.text).join('\n'),
          segmentIds: segments.map((segment) => segment.id).join('\n'),
          interimText: caption?.text ?? '',
        },
        prompt: {
          system: PROMPT_TRIGGER_SYSTEM,
          contextBlocks: [...transcript.blocks, this.context.renderState()],
          cacheIndex: transcript.cacheIndex,
          instruction: buildPromptTriggerInstruction({
            languageInsight: language === 'ja' ? 'Japanese' : 'English',
            proactivity: meta.proactivity,
            urgencyMinimum: Math.min(1, getUrgencyThreshold(meta.proactivity)),
            wakeWords: meta.wakeWords,
            segmentIdsNew: segments.map((segment) => segment.id),
            interimText: caption?.text ?? '',
          }),
        },
        schema: triggerSchema,
        maxTokens: 1200,
      })
      this.listener.onProposals({
        proposals: output.proposals,
        topic: output.topic,
        language,
        segments,
        interimText: caption?.text ?? '',
        utteranceAt: caption?.updatedAt ?? segments.at(-1)?.finalizedAt ?? startedAt,
        routerMs: Date.now() - startedAt,
      })
    } catch (error) {
      this.log.warn({ error: String(error) }, 'router call failed')
    } finally {
      this.isRunning = false
      if (this.isRerunWanted || this.segmentsPending.length > 0) {
        this.isRerunWanted = false
        void this.run(null)
      }
    }
  }
}

/**
 * Returns the command following a wake word, or null when the text does not address the agent.
 *
 * @param text - Utterance text.
 * @param wakeWordsNormalized - Wake words normalized with normalizeText.
 */
export function extractCommand(text: string, wakeWordsNormalized: string[]): string | null {
  const normalized = normalizeText(text)
  for (const wakeWord of wakeWordsNormalized) {
    if (!normalized.includes(wakeWord)) continue
    // drop everything up to and including the wake word, keeping the original spacing
    const pattern = new RegExp(
      wakeWord
        .split('')
        .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[\\s\\p{P}]*'),
      'iu',
    )
    const match = pattern.exec(text.normalize('NFKC'))
    const rest = match ? text.normalize('NFKC').slice(match.index + match[0].length) : text
    return rest.replace(/^[\s\p{P}]+/u, '').trim() || text.trim()
  }
  return null
}

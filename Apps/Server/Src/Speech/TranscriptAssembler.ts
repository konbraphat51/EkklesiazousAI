// Turns a provider token stream into live captions and finalized, single-speaker segments.
import { nanoid } from 'nanoid'
import type { CaptionLive, LanguageSpoken, TranscriptSegment } from '@ekklesiazous/shared'
import type { RecognitionUpdate, RecognizedToken } from './SpeechRecognizer'

const SENTENCE_END = /[。．.!?！？]\s*$/
const SOFT_FLUSH_CHARACTERS = 160
const HARD_FLUSH_CHARACTERS = 400
const IDLE_FLUSH_MS = 1500

/** Callbacks receiving assembled output. */
export interface TranscriptAssemblerHandlers {
  /** Receives the live caption of the stream, or null when nothing is pending. */
  onCaption(caption: CaptionLive | null): void
  /** Receives each finalized segment. */
  onSegment(segment: TranscriptSegment): void
}

/** Settings of one assembler (one per audio stream). */
export interface TranscriptAssemblerOptions {
  /** Audio stream identifier. */
  sourceId: string
  /** Offset of the stream start from the meeting start, in milliseconds. */
  streamOffsetMs: number
  /** Maps a provider speaker label to a board speaker id. */
  resolveSpeakerId(label: string | null): string
  /** Current wall-clock time (injectable for tests). */
  now?: () => number
}

/** Assembles recognition updates of one audio stream. */
export class TranscriptAssembler {
  private tokensPending: RecognizedToken[] = []
  private tokensInterim: RecognizedToken[] = []
  private lastUpdateAt: number
  private readonly now: () => number

  /**
   * @param options - Stream settings.
   * @param handlers - Output callbacks.
   */
  constructor(
    private readonly options: TranscriptAssemblerOptions,
    private readonly handlers: TranscriptAssemblerHandlers,
  ) {
    this.now = options.now ?? Date.now
    this.lastUpdateAt = this.now()
  }

  /**
   * Consumes one recognition update.
   *
   * @param update - Update from the recognizer.
   */
  accept(update: RecognitionUpdate): void {
    this.lastUpdateAt = this.now()
    for (const token of update.tokensFinal) {
      const last = this.tokensPending.at(-1)
      // a new speaker starts a new segment
      if (
        last &&
        token.speaker !== null &&
        last.speaker !== null &&
        token.speaker !== last.speaker
      ) {
        this.flush()
      }
      this.tokensPending.push(token)
    }
    this.tokensInterim = update.tokensInterim

    const textPending = joinText(this.tokensPending)
    const isSoftFlushDue =
      textPending.length >= SOFT_FLUSH_CHARACTERS && SENTENCE_END.test(textPending)
    if (update.isEndpoint || isSoftFlushDue || textPending.length >= HARD_FLUSH_CHARACTERS) {
      this.flush()
    }
    this.emitCaption()
  }

  /** Flushes pending final speech if the stream has been quiet for a while (call periodically). */
  flushIfIdle(): void {
    if (this.tokensPending.length === 0) return
    if (this.now() - this.lastUpdateAt < IDLE_FLUSH_MS) return
    this.flush()
    this.emitCaption()
  }

  /** Flushes everything, e.g. when the stream closes. */
  flushAll(): void {
    this.tokensPending.push(...this.tokensInterim)
    this.tokensInterim = []
    this.flush()
    this.handlers.onCaption(null)
  }

  private flush(): void {
    const tokens = this.tokensPending
    this.tokensPending = []
    const text = joinText(tokens)
    const first = tokens[0]
    const last = tokens.at(-1)
    if (!first || !last || text.length === 0) return
    this.handlers.onSegment({
      id: nanoid(12),
      speakerId: this.options.resolveSpeakerId(first.speaker),
      text,
      language: detectLanguage(tokens),
      sourceId: this.options.sourceId,
      startMs: this.options.streamOffsetMs + first.startMs,
      endMs: this.options.streamOffsetMs + last.endMs,
      finalizedAt: this.now(),
    })
  }

  private emitCaption(): void {
    const tokens = [...this.tokensPending, ...this.tokensInterim]
    const text = joinText(tokens)
    if (text.length === 0) {
      this.handlers.onCaption(null)
      return
    }
    const speakerLabel = tokens.findLast((token) => token.speaker !== null)?.speaker ?? null
    this.handlers.onCaption({
      sourceId: this.options.sourceId,
      speakerId: speakerLabel === null ? null : this.options.resolveSpeakerId(speakerLabel),
      text,
      language: detectLanguage(tokens),
      updatedAt: this.now(),
    })
  }
}

function joinText(tokens: RecognizedToken[]): string {
  return tokens
    .map((token) => token.text)
    .join('')
    .trim()
}

// the language covering the most characters wins
function detectLanguage(tokens: RecognizedToken[]): LanguageSpoken {
  const counts = new Map<LanguageSpoken, number>()
  for (const token of tokens) {
    counts.set(token.language, (counts.get(token.language) ?? 0) + token.text.trim().length)
  }
  let best: LanguageSpoken = 'other'
  let bestCount = -1
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language
      bestCount = count
    }
  }
  return best
}

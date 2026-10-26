// Finalized and in-progress transcript units produced by speech recognition.
import type { LanguageSpoken } from './Language'

/** A finalized utterance (one speaker, one contiguous turn). */
export interface TranscriptSegment {
  /** Unique identifier. */
  id: string
  /** Speaker who produced the utterance. */
  speakerId: string
  /** Recognized text. */
  text: string
  /** Dominant language of the utterance. */
  language: LanguageSpoken
  /** Audio stream the utterance came from. */
  sourceId: string
  /** Start offset from meeting start, in milliseconds. */
  startMs: number
  /** End offset from meeting start, in milliseconds. */
  endMs: number
  /** Wall-clock time (epoch ms) at which the recognizer finalized the utterance. */
  finalizedAt: number
}

/** The not-yet-final text currently being spoken on one audio stream. */
export interface CaptionLive {
  /** Audio stream identifier. */
  sourceId: string
  /** Speaker currently talking on the stream, if known. */
  speakerId: string | null
  /** Final-but-not-yet-segmented text followed by interim text. */
  text: string
  /** Dominant language of the caption. */
  language: LanguageSpoken
  /** Wall-clock time (epoch ms) of the last update. */
  updatedAt: number
}

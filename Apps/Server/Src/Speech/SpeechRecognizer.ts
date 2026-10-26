// Provider-neutral contract for streaming speech recognition.
import type { LanguageSpoken } from '@ekklesiazous/shared'

/** One recognized unit (word, sub-word or whole turn, depending on the provider). */
export interface RecognizedToken {
  /** Text including any leading space the provider emits. */
  text: string
  /** Start offset from the start of the stream, in milliseconds. */
  startMs: number
  /** End offset from the start of the stream, in milliseconds. */
  endMs: number
  /** Diarized speaker label from the provider (e.g. "1" or "A"), or null if unknown. */
  speaker: string | null
  /** Detected language. */
  language: LanguageSpoken
}

/** Incremental recognition result. */
export interface RecognitionUpdate {
  /** Tokens finalized by this update (never revised later). */
  tokensFinal: RecognizedToken[]
  /** The complete current set of interim tokens (replaces the previous set). */
  tokensInterim: RecognizedToken[]
  /** Whether the provider detected the end of an utterance after `tokensFinal`. */
  isEndpoint: boolean
}

/** Callbacks of a recognition session. */
export interface RecognitionHandlers {
  /** Receives every recognition update. */
  onUpdate(update: RecognitionUpdate): void
  /** Receives fatal errors; the session is closed afterwards. */
  onError(error: Error): void
}

/** Options for opening a session. */
export interface RecognitionOptions {
  /** Expected languages, e.g. `['ja', 'en']`. */
  languageHints: string[]
  /** Whether several speakers share the stream and must be separated. */
  isDiarizationWanted: boolean
  /** Domain terms that improve recognition (names, jargon). */
  terms: string[]
}

/** A live recognition stream fed with PCM16LE mono 16 kHz audio. */
export interface RecognitionSession {
  /**
   * Sends one chunk of audio.
   *
   * @param pcm - PCM16LE mono 16 kHz samples.
   */
  sendAudio(pcm: Uint8Array): void
  /** Asks the provider to finalize pending speech immediately. */
  finalize(): void
  /** Ends the stream gracefully and waits for the last results. */
  close(): Promise<void>
}

/** Factory of recognition sessions for one provider. */
export interface SpeechRecognizer {
  /** Provider name for logs and capability reports. */
  readonly name: string
  /**
   * Opens a streaming session.
   *
   * @param options - Languages, diarization and vocabulary.
   * @param handlers - Result and error callbacks.
   */
  open(options: RecognitionOptions, handlers: RecognitionHandlers): Promise<RecognitionSession>
}

/**
 * Maps a provider language code to the spoken-language union.
 *
 * @param code - ISO code such as `ja`, `en`, `en-US` or `ja_jp`.
 */
export function toLanguageSpoken(code: string | null | undefined): LanguageSpoken {
  const normalized = (code ?? '').toLowerCase()
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('en')) return 'en'
  return 'other'
}

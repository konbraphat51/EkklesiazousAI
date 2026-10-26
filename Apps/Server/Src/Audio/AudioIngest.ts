// Turns one incoming PCM stream into board captions and segments via a speech recognizer.
import type { CaptureMode, DocumentBoard } from '@ekklesiazous/shared'
import type { AgentLogger } from '../Agent/AgentToolkit'
import { SpeakerDirectory } from '../Speech/SpeakerDirectory'
import type { SpeechRecognizer } from '../Speech/SpeechRecognizer'
import { TranscriptAssembler } from '../Speech/TranscriptAssembler'
import { EchoGuard } from './EchoGuard'

const IDLE_CHECK_MS = 400

/** Description of one audio stream. */
export interface AudioStreamOptions {
  /** Stream id unique within the room. */
  sourceId: string
  /** Capture mode (decides diarization). */
  captureMode: CaptureMode
  /** Known speaker of a single-speaker stream, or null to diarize. */
  speakerName: string | null
  /** Expected languages. */
  languageHints: string[]
}

/** A live stream feeding the board. */
export interface AudioStreamHandle {
  /** Recognizer serving the stream. */
  readonly recognizerName: string
  /**
   * Pushes PCM16LE mono 16 kHz audio.
   *
   * @param pcm - Audio bytes.
   */
  push(pcm: Uint8Array): void
  /** Ends the stream, flushing the last words. */
  close(): Promise<void>
}

/** Opens recognizer-backed streams into boards. */
export class AudioIngest {
  /**
   * @param recognizer - Speech recognizer, or null when none is configured.
   * @param log - Logger.
   */
  constructor(
    private readonly recognizer: SpeechRecognizer | null,
    private readonly log: AgentLogger,
  ) {}

  /** Whether a recognizer is configured. */
  get isAvailable(): boolean {
    return this.recognizer !== null
  }

  /**
   * Opens a stream into a board.
   *
   * @param board - Target board.
   * @param options - Stream description.
   * @throws Error when no recognizer is configured or the provider rejects the connection.
   */
  async open(board: DocumentBoard, options: AudioStreamOptions): Promise<AudioStreamHandle> {
    if (!this.recognizer) {
      throw new Error('No speech recognizer configured: set SONIOX_API_KEY or ASSEMBLYAI_API_KEY')
    }
    const meta = board.readMeta()
    const startedAt = meta.startedAt ?? Date.now()
    if (!meta.startedAt) board.patchMeta({ startedAt }, 'system')

    const speakers = new SpeakerDirectory(board)
    const echoGuard = new EchoGuard(board)
    const isSingleSpeaker = options.speakerName !== null && options.speakerName.trim().length > 0
    const namedId = isSingleSpeaker ? speakers.resolveNamed(options.speakerName!) : null
    const assembler = new TranscriptAssembler(
      {
        sourceId: options.sourceId,
        streamOffsetMs: Date.now() - startedAt,
        resolveSpeakerId: (label) => namedId ?? speakers.resolveDiarized(options.sourceId, label),
      },
      {
        onCaption: (caption) => board.setCaption(options.sourceId, caption),
        onSegment: (segment) =>
          echoGuard.admit(segment, isSingleSpeaker, (admitted) => board.appendSegment(admitted)),
      },
    )
    const terms = [...board.listGlossary().map((entry) => entry.term), ...meta.wakeWords].slice(
      0,
      200,
    )
    const session = await this.recognizer.open(
      { languageHints: options.languageHints, isDiarizationWanted: !isSingleSpeaker, terms },
      {
        onUpdate: (update) => assembler.accept(update),
        onError: (error) =>
          this.log.warn({ error: String(error), sourceId: options.sourceId }, 'recognizer error'),
      },
    )
    const idleTimer = setInterval(() => assembler.flushIfIdle(), IDLE_CHECK_MS)
    let isClosed = false

    return {
      recognizerName: this.recognizer.name,
      push: (pcm) => {
        if (!isClosed) session.sendAudio(pcm)
      },
      close: async () => {
        if (isClosed) return
        isClosed = true
        clearInterval(idleTimer)
        await session.close()
        assembler.flushAll()
      },
    }
  }
}

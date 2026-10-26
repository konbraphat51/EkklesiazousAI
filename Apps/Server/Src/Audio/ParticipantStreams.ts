// One recognizer stream per remote participant, opened on first audio and closed when silent
// (recognizers bill by connection time). Shared by the Zoom RTMS and meeting-bot gateways.
import type { CaptureMode, DocumentBoard } from '@ekklesiazous/shared'
import type { AgentLogger } from '../Agent/AgentToolkit'
import type { AudioIngest, AudioStreamHandle } from './AudioIngest'

const IDLE_CLOSE_MS = 30_000
const IDLE_CHECK_MS = 5000

interface ParticipantStream {
  handle: Promise<AudioStreamHandle>
  lastAudioAt: number
}

/** Per-participant streams of one remote meeting. */
export class ParticipantStreams {
  private readonly streams = new Map<string, ParticipantStream>()
  private readonly timer: NodeJS.Timeout

  /**
   * @param board - Target board.
   * @param ingest - Stream opener.
   * @param captureMode - Capture mode announced for the streams.
   * @param sourcePrefix - Prefix of stream ids (e.g. `zoom`).
   * @param log - Logger.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly ingest: AudioIngest,
    private readonly captureMode: CaptureMode,
    private readonly sourcePrefix: string,
    private readonly log: AgentLogger,
  ) {
    this.timer = setInterval(() => this.closeIdle(), IDLE_CHECK_MS)
  }

  /**
   * Pushes audio of one participant.
   *
   * @param participantKey - Stable participant id from the provider.
   * @param participantName - Display name.
   * @param pcm - PCM16LE mono 16 kHz audio.
   */
  push(participantKey: string, participantName: string, pcm: Uint8Array): void {
    let stream = this.streams.get(participantKey)
    if (!stream) {
      stream = {
        handle: this.ingest.open(this.board, {
          sourceId: `${this.sourcePrefix}:${participantKey}`,
          captureMode: this.captureMode,
          speakerName: participantName || `${this.sourcePrefix} ${participantKey}`,
          languageHints: ['ja', 'en'],
        }),
        lastAudioAt: Date.now(),
      }
      stream.handle.catch((error: unknown) =>
        this.log.warn({ error: String(error) }, 'participant stream failed'),
      )
      this.streams.set(participantKey, stream)
    }
    stream.lastAudioAt = Date.now()
    void stream.handle.then((handle) => handle.push(pcm)).catch(() => undefined)
  }

  /** Closes every stream. */
  close(): void {
    clearInterval(this.timer)
    for (const stream of this.streams.values()) {
      void stream.handle.then((handle) => handle.close()).catch(() => undefined)
    }
    this.streams.clear()
  }

  private closeIdle(): void {
    const now = Date.now()
    for (const [key, stream] of this.streams) {
      if (now - stream.lastAudioAt < IDLE_CLOSE_MS) continue
      this.streams.delete(key)
      void stream.handle.then((handle) => handle.close()).catch(() => undefined)
    }
  }
}

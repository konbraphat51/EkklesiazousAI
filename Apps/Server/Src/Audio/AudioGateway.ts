// Serves browser audio WebSockets (`/ws/audio/:roomId`): a JSON start message, then binary PCM frames.
import { WebSocket, type RawData } from 'ws'
import { z } from 'zod'
import type { AudioMessageServer } from '@ekklesiazous/shared'
import type { AgentLogger } from '../Agent/AgentToolkit'
import type { RoomRuntime } from '../Rooms/RoomRuntime'
import type { AudioIngest, AudioStreamHandle } from './AudioIngest'

const startSchema = z.object({
  type: z.literal('start'),
  sourceId: z.string().min(1).max(80),
  captureMode: z.enum([
    'roomMicrophone',
    'onlineHostCapture',
    'onlinePerParticipant',
    'zoomRtms',
    'demo',
  ]),
  speakerName: z.string().max(80).nullable(),
  languageHints: z.array(z.string().max(8)).max(4),
})

/** Bridges browser microphones and tab audio to the recognizer. */
export class AudioGateway {
  /**
   * @param ingest - Stream opener.
   * @param log - Logger.
   */
  constructor(
    private readonly ingest: AudioIngest,
    private readonly log: AgentLogger,
  ) {}

  /**
   * Handles one upgraded audio socket.
   *
   * @param socket - Client connection.
   * @param room - Target room.
   */
  handleConnection(socket: WebSocket, room: RoomRuntime): void {
    let stream: AudioStreamHandle | null = null
    let isStarting = false

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        stream?.push(toUint8Array(data))
        return
      }
      const message = parseJson(data.toString())
      if (isStopMessage(message)) {
        void stream?.close()
        socket.close(1000)
        return
      }
      const start = startSchema.safeParse(message)
      if (!start.success || stream || isStarting) return
      isStarting = true
      this.ingest
        .open(room.board, {
          sourceId: start.data.sourceId,
          captureMode: start.data.captureMode,
          speakerName:
            start.data.captureMode === 'onlinePerParticipant' ? start.data.speakerName : null,
          languageHints:
            start.data.languageHints.length > 0 ? start.data.languageHints : ['ja', 'en'],
        })
        .then((handle) => {
          stream = handle
          room.handleAudioStarted()
          send(socket, { type: 'ready', recognizer: handle.recognizerName })
        })
        .catch((error: unknown) => {
          this.log.warn({ error: String(error) }, 'audio stream failed to start')
          send(socket, {
            type: 'error',
            message: String(error instanceof Error ? error.message : error),
          })
          socket.close(1011)
        })
    })
    socket.on('close', () => void stream?.close())
  }
}

function send(socket: WebSocket, message: AudioMessageServer): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isStopMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'stop'
  )
}

function toUint8Array(data: RawData): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data))
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

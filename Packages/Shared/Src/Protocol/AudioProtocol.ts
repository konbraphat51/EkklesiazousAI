// Messages exchanged on the audio WebSocket (`/ws/audio/:roomId`); audio itself travels as binary frames.
import type { CaptureMode } from '../Model/MeetingMeta'

/** Sample rate of the PCM audio the client streams. */
export const AUDIO_SAMPLE_RATE = 16000

/** Duration of one binary PCM frame sent by the client, in milliseconds. */
export const AUDIO_FRAME_MS = 40

/** First message from the client: describes the stream that follows as binary PCM16LE mono frames. */
export interface AudioMessageStart {
  type: 'start'
  /** Stream identifier unique within the room (one per capturing device). */
  sourceId: string
  /** Capture mode, which decides whether the server diarizes the stream. */
  captureMode: CaptureMode
  /** Participant name when the stream carries a single known speaker (per-participant mode). */
  speakerName: string | null
  /** Expected spoken languages, e.g. `['ja', 'en']`. */
  languageHints: string[]
}

/** Client asks the server to finish the stream gracefully. */
export interface AudioMessageStop {
  type: 'stop'
}

/** Control messages from client to server. */
export type AudioMessageClient = AudioMessageStart | AudioMessageStop

/** Server reports that recognition is running. */
export interface AudioMessageReady {
  type: 'ready'
  /** Name of the speech recognizer serving the stream. */
  recognizer: string
}

/** Server reports a failure; the client should stop streaming. */
export interface AudioMessageError {
  type: 'error'
  /** Human-readable explanation. */
  message: string
}

/** Control messages from server to client. */
export type AudioMessageServer = AudioMessageReady | AudioMessageError

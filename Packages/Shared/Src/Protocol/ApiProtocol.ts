// Request and response bodies of the server's REST API.
import type { CaptureMode } from '../Model/MeetingMeta'

/** `POST /api/rooms` request body. */
export interface RoomCreateRequest {
  /** Meeting title. */
  title: string
  /** Initial capture mode. */
  captureMode: CaptureMode
}

/** `POST /api/rooms` response body. */
export interface RoomCreateResponse {
  /** Identifier of the new room; also the Yjs document name. */
  roomId: string
}

/** `POST /api/rooms/:roomId/questions` request body: a question typed to the agent. */
export interface QuestionAskRequest {
  /** The question. */
  text: string
  /** Display name of the participant asking. */
  askerName: string
}

/** `POST /api/rooms/:roomId/agent` request body: start or stop processing. */
export interface AgentControlRequest {
  /** Requested action. */
  action: 'start' | 'pause' | 'startDemo'
}

/** `GET /api/config` response body: which providers the server is configured with. */
export interface ServerCapabilities {
  /** Speech recognizer in use (e.g. `soniox`, `deepgram`, or `none`). */
  recognizer: string
  /** Fast language model id used for trigger detection and writing. */
  modelFast: string
  /** Deep language model id used for issue mapping and critique. */
  modelDeep: string
  /** Search providers in use. */
  searchProviders: string[]
  /** Whether everything runs on scripted/mock providers (no API keys configured). */
  isMockMode: boolean
  /** Whether Zoom RTMS credentials are configured. */
  isZoomRtmsEnabled: boolean
}

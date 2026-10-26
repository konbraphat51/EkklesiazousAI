// Request and response bodies of the server's REST API.
import type { CaptureMode } from '../Model/MeetingMeta'
import type { LanguageInsight } from '../Model/Language'
import type { ResearchDepth } from '../Model/Research'
import type { InsightLayer } from '../Model/Insight'

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

/** `POST /api/rooms/:roomId/commands` request body: a research command typed by a participant. */
export interface ResearchCommandRequest {
  /** What to research, in natural language. */
  text: string
  /** Display name of the requester (shown on public results). */
  requesterName: string
  /** Random per-browser identifier. */
  participantId: string
  /** Research intensity. */
  depth: ResearchDepth
  /**
   * When true the result is streamed back only to the requester as NDJSON `Insight` snapshots;
   * otherwise it is placed on the shared board.
   */
  isPrivate: boolean
}

/** `POST /api/rooms/:roomId/commands` response body for public commands. */
export interface ResearchCommandResponse {
  /** Identifier of the insight created on the board. */
  insightId: string
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

/**
 * `POST /api/rooms/:roomId/clarifications` request body: one participant privately signals that
 * they could not follow. The response is an NDJSON stream of `Clarification` snapshots.
 */
export interface ClarificationAskRequest {
  /** Random per-browser identifier; never a name, so requests stay anonymous. */
  participantId: string
  /** Flagged utterances; empty means "the last few seconds of speech". */
  segmentIds: string[]
  /** Specific phrase the participant selected, if any. */
  selectedText: string | null
  /** Language the participant wants the explanation in. */
  language: LanguageInsight
  /** Optional self-description of the participant's background, used to pitch the explanation. */
  background: string
}

/** `POST /api/rooms/:roomId/clarifications/:clarificationId/share` response body. */
export interface ClarificationShareResponse {
  /** Identifier of the public catch-up insight created on the board. */
  insightId: string
}

/**
 * `POST /api/rooms/:roomId/insights/:insightId/layers` request body: generate a deeper layer of an
 * insight on demand. Idempotent; the result is written to the shared board.
 */
export interface InsightLayerRequest {
  /** Layer to generate. */
  layer: InsightLayer
  /** True when triggered by hover intent rather than an explicit click. */
  isPrefetch: boolean
}

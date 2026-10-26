// Room-wide settings and status of a meeting.
import type { InsightKind } from './Insight'
import type { LanguageInsightPreference } from './Language'
import type { Proactivity, ResearchDepth } from './Research'
import type { UxSettings } from '../Experiment/UxFeatures'

/**
 * How meeting audio reaches the server.
 *
 * - `roomMicrophone`: one microphone in a physical room; speakers are separated by diarization.
 * - `onlineHostCapture`: the host captures the online meeting's output audio (Google Meet / Zoom web
 *   tab, or system audio for desktop clients) plus their own microphone; speakers are diarized.
 * - `onlinePerParticipant`: every participant streams their own microphone from this app.
 * - `zoomRtms`: Zoom Realtime Media Streams deliver per-participant audio to the server.
 * - `meetingBot`: a meeting bot (Recall.ai) joins Google Meet, Teams or Zoom and delivers
 *   per-participant audio with names (experimental).
 * - `demo`: a scripted meeting is replayed (no microphone, no API keys required).
 */
export type CaptureMode =
  | 'roomMicrophone'
  | 'onlineHostCapture'
  | 'onlinePerParticipant'
  | 'zoomRtms'
  | 'meetingBot'
  | 'demo'

/** Where the meeting takes place (used for capture instructions and integrations). */
export type MeetingPlatform = 'inPerson' | 'zoom' | 'googleMeet' | 'teams' | 'other'

/** Every meeting platform, in menu order. */
export const MEETING_PLATFORMS: readonly MeetingPlatform[] = [
  'inPerson',
  'zoom',
  'googleMeet',
  'teams',
  'other',
]

/** Agent run state. */
export type AgentState = 'idle' | 'listening' | 'paused'

/** Room-wide settings and status. */
export interface MeetingMeta {
  /** Meeting title. */
  title: string
  /** Room creation time (epoch ms). */
  createdAt: number
  /** Time the first audio arrived (epoch ms), used as the transcript origin. */
  startedAt: number | null
  /** Where the meeting takes place. */
  meetingPlatform: MeetingPlatform
  /** Capture mode selected for the meeting. */
  captureMode: CaptureMode
  /** Language preference for insights. */
  languageInsight: LanguageInsightPreference
  /** Room-wide UX feature options (defaults for participant-scoped features). */
  uxSettings: UxSettings
  /** When true, participants cannot override UX options (controlled experiments). */
  isUxLocked: boolean
  /** Whether the agent is processing speech. */
  agentState: AgentState
  /** Insight kinds the agent may produce. */
  kindsEnabled: Record<InsightKind, boolean>
  /** How eagerly the agent volunteers insights nobody asked for. */
  proactivity: Proactivity
  /** Research depth of proactive insights (explicit commands choose their own). */
  researchDepthDefault: ResearchDepth
  /** Phrases that address the agent by voice, e.g. "Hey Ekklesia" or 「エクレシア」. */
  wakeWords: string[]
  /** Insight currently promoted to the shared spotlight frame, if any. */
  spotlightInsightId: string | null
  /** When the spotlight was set (epoch ms). */
  spotlightAt: number | null
  /** Rolling "meeting so far" summary written by the agent. */
  summary: string
  /** When the summary was last updated (epoch ms). */
  summaryUpdatedAt: number | null
  /** Zoom meeting id whose RTMS audio feeds this room (empty when unused). */
  zoomMeetingId: string
  /**
   * Whether a moment privately flagged by several participants is promoted to an anonymous public
   * catch-up insight.
   */
  isClarificationPromotionEnabled: boolean
}

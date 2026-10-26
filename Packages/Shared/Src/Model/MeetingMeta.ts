// Room-wide settings and status of a meeting.
import type { InsightKind } from './Insight'
import type { LanguageInsightPreference } from './Language'
import type { Proactivity, ResearchDepth } from './Research'
import type { VariantId } from '../Presentation/VariantId'

/**
 * How meeting audio reaches the server.
 *
 * - `roomMicrophone`: one microphone in a physical room; speakers are separated by diarization.
 * - `zoomHostCapture`: the host captures Zoom's output audio (tab/system) plus their own microphone.
 * - `zoomPerParticipant`: every participant streams their own microphone from this app.
 * - `zoomRtms`: Zoom Realtime Media Streams deliver per-participant audio to the server.
 * - `demo`: a scripted meeting is replayed (no microphone, no API keys required).
 */
export type CaptureMode =
  'roomMicrophone' | 'zoomHostCapture' | 'zoomPerParticipant' | 'zoomRtms' | 'demo'

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
  /** Capture mode selected for the meeting. */
  captureMode: CaptureMode
  /** Language preference for insights. */
  languageInsight: LanguageInsightPreference
  /** Presentation variant shown to participants who have not picked their own. */
  variantDefault: VariantId
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
  /**
   * Whether a moment privately flagged by several participants is promoted to an anonymous public
   * catch-up insight.
   */
  isClarificationPromotionEnabled: boolean
}

// Interaction events logged for UX experiments (`POST /api/rooms/:roomId/events`).
import type { UxSettings } from '../Experiment/UxFeatures'

/** Kinds of logged participant interaction. */
export type InteractionEventType =
  | 'sessionStarted'
  | 'uxChanged'
  | 'cardShown'
  | 'cardHovered'
  | 'cardExpanded'
  | 'cardCollapsed'
  | 'layerRequested'
  | 'sourceOpened'
  | 'cardVoted'
  | 'cardPinned'
  | 'cardDismissed'
  | 'clarificationRequested'
  | 'clarificationShared'
  | 'commandIssued'
  | 'dissentRaised'
  | 'noteCreated'
  | 'viewportMoved'

/** One logged interaction. */
export interface InteractionEvent {
  /** Event kind. */
  type: InteractionEventType
  /** Random per-browser participant identifier. */
  participantId: string
  /** Target item (insight, segment, note...) if any. */
  targetId: string | null
  /** Effective UX settings of the participant at the time of the event. */
  ux: UxSettings
  /** Event-specific details. */
  details: Record<string, string | number | boolean | null>
  /** Client wall-clock time (epoch ms). */
  at: number
}

/** `POST /api/rooms/:roomId/events` request body. */
export interface InteractionEventBatch {
  /** Events in chronological order. */
  events: InteractionEvent[]
}

// Information the agent surfaces to participants (researched references, explainers, critiques...).
import type { LanguageInsight } from './Language'
import type { ResearchDepth } from './Research'

/**
 * Kinds of insight, each mapped to a weakness of live spoken discussion.
 *
 * - `priorArt`: existing products, papers or cases that the group may be about to reinvent.
 * - `catchUp`: explainer of a term, paper or case some participants may not know.
 * - `factCheck`: verification of a factual claim made in the discussion.
 * - `critique`: devil's advocate — weaknesses, risks, overlooked alternatives.
 * - `answer`: result of an explicit research command (typed or spoken) from a participant.
 */
export type InsightKind = 'priorArt' | 'catchUp' | 'factCheck' | 'critique' | 'answer'

/** Every insight kind, in display order. */
export const INSIGHT_KINDS: readonly InsightKind[] = [
  'priorArt',
  'catchUp',
  'factCheck',
  'critique',
  'answer',
]

/**
 * Why an insight exists.
 *
 * - `proactive`: the agent volunteered it from the conversation.
 * - `command`: a participant asked for it (typed or by voice).
 * - `clarification`: promoted from private clarification requests (anonymous).
 * - `proxyDissent`: a participant's anonymous concern, voiced by the agent as its own critique.
 */
export type InsightOrigin = 'proactive' | 'command' | 'clarification' | 'proxyDissent'

/**
 * Conversational pattern that made the agent act (logged for research, shown as provenance).
 *
 * - `newIdea`: a proposal that may reinvent something existing.
 * - `unfamiliarTerm`: a term, paper or case some participants may not know.
 * - `claim`: a checkable factual statement or number.
 * - `anchoring`: a single number or first proposal dominating the discussion.
 * - `quickAgreement`: convergence without alternatives or risks (groupthink signal).
 * - `authorityAppeal`: reliance on authority instead of evidence.
 * - `untestedAssumption`: a plan resting on an unverified assumption.
 * - `deferredQuestion`: an open question parked for later ("let's check later").
 * - `explicitRequest`: a participant addressed the agent.
 * - `confusion`: several participants privately asked for clarification.
 * - `dissent`: a participant's anonymous concern.
 */
export type TriggerPattern =
  | 'newIdea'
  | 'unfamiliarTerm'
  | 'claim'
  | 'anchoring'
  | 'quickAgreement'
  | 'authorityAppeal'
  | 'untestedAssumption'
  | 'deferredQuestion'
  | 'explicitRequest'
  | 'confusion'
  | 'dissent'

/** Every trigger pattern. */
export const TRIGGER_PATTERNS: readonly TriggerPattern[] = [
  'newIdea',
  'unfamiliarTerm',
  'claim',
  'anchoring',
  'quickAgreement',
  'authorityAppeal',
  'untestedAssumption',
  'deferredQuestion',
  'explicitRequest',
  'confusion',
  'dissent',
]

/** Lifecycle of an insight's gist; the card is shown from `researching` onward. */
export type InsightStatus = 'researching' | 'writing' | 'ready' | 'failed' | 'dismissed'

/**
 * Layers of progressive disclosure: the title and gist are always produced, deeper layers only on
 * demand (a participant expands the card) or when the research depth asks for them up front.
 */
export type InsightLayer = 'detail' | 'deep'

/** Generation state of an on-demand layer. */
export type InsightLayerStatus = 'none' | 'running' | 'ready' | 'failed'

/** A titled group of points in the deep layer. */
export interface InsightSection {
  /** Section heading. */
  heading: string
  /** Points of the section. */
  points: string[]
}

/** Verdict of a fact check. */
export type InsightVerdict = 'supported' | 'disputed' | 'unclear'

/** A reference backing an insight. */
export interface InsightSource {
  /** Title of the page or paper. */
  title: string
  /** Link to the source. */
  url: string
  /** Short excerpt shown under the title. */
  snippet: string
  /** Site, venue or publisher name. */
  publisher: string
  /** Publication year when known. */
  year: number | null
  /** Category of the source, used for the source icon. */
  category: 'web' | 'paper' | 'encyclopedia'
}

/** Latency instrumentation, all wall-clock epoch milliseconds. */
export interface InsightTimings {
  /** When the recognizer finalized the triggering utterance (or the interim text was observed). */
  utteranceAt: number
  /** When the trigger detector decided to create the insight. */
  triggeredAt: number
  /** When the first characters of the gist became visible. */
  firstContentAt: number | null
  /** When the gist was complete. */
  readyAt: number | null
  /** When the card became visible to participants (after delivery timing). */
  releasedAt: number | null
  /** When the detail layer was first requested. */
  detailRequestedAt: number | null
  /** When the detail layer was complete. */
  detailReadyAt: number | null
  /** When the deep layer was first requested. */
  deepRequestedAt: number | null
  /** When the deep layer was complete. */
  deepReadyAt: number | null
  /** Whether the trigger fired on interim (not yet final) speech. */
  isSpeculative: boolean
}

/** One piece of information presented on the canvas. */
export interface Insight {
  /** Unique identifier. */
  id: string
  /** What kind of help the insight provides. */
  kind: InsightKind
  /** Lifecycle status. */
  status: InsightStatus
  /** Topic the insight belongs to. */
  topicId: string | null
  /** Issue-map node the insight supports or challenges, if any. */
  issueNodeId: string | null
  /** Conversational pattern that triggered the insight. */
  triggerPattern: TriggerPattern
  /** Short headline (shown immediately, before research finishes). */
  title: string
  /** One plain sentence: the default, glanceable presentation. */
  gist: string
  /** Generation state of the detail layer. */
  detailStatus: InsightLayerStatus
  /** Detail layer: two or three sentence summary. */
  summary: string
  /** Detail layer: key points. */
  bullets: string[]
  /** Generation state of the deep layer. */
  deepStatus: InsightLayerStatus
  /** Deep layer: structured findings. */
  sections: InsightSection[]
  /** Supporting references (accumulated across layers). */
  sources: InsightSource[]
  /** Fact-check verdict; null for other kinds. */
  verdict: InsightVerdict | null
  /** How urgently participants should see this, 0..1. */
  urgency: number
  /** Agent's confidence in the content, 0..1. */
  confidence: number
  /** Language the insight is written in. */
  language: LanguageInsight
  /** Search query used for research. */
  query: string
  /** Why the insight exists. */
  origin: InsightOrigin
  /** Research intensity spent on this insight. */
  depth: ResearchDepth
  /** Short progress note while researching (e.g. "Reading 8 sources"); empty when idle. */
  progressNote: string
  /** Name of the participant who explicitly requested this; null for proactive insights. */
  requesterName: string | null
  /** Why the agent surfaced this, shown for transparency. */
  reason: string
  /** Utterances that triggered the insight. */
  triggerSegmentIds: string[]
  /** Excerpt of the triggering speech. */
  triggerQuote: string
  /** Creation time (epoch ms). */
  createdAt: number
  /** Last update time (epoch ms). */
  updatedAt: number
  /** Latency instrumentation. */
  timings: InsightTimings
  /** Whether a participant pinned the card (pinned cards never fade). */
  isPinned: boolean
  /** Participant votes on usefulness, keyed by participant id. */
  votes: Record<string, 'up' | 'down'>
}

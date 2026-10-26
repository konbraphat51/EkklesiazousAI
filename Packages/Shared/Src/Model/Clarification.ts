// Private explanations requested by one participant who could not follow part of the discussion.
import type { InsightSource } from './Insight'
import type { LanguageInsight } from './Language'

/** Lifecycle of a clarification. */
export type ClarificationStatus = 'writing' | 'ready' | 'failed'

/** A term the participant may not know, with a short explanation. */
export interface ClarificationTerm {
  /** The term as spoken. */
  term: string
  /** Plain-language explanation. */
  explanation: string
}

/**
 * Explanation delivered only to the participant who asked; it is never written to the shared board
 * unless that participant shares it.
 */
export interface Clarification {
  /** Unique identifier. */
  id: string
  /** Lifecycle status. */
  status: ClarificationStatus
  /** What was said (the flagged speech). */
  quote: string
  /** Plain-language restatement of what the speaker meant. */
  rephrase: string
  /** Terms explained. */
  terms: ClarificationTerm[]
  /** Background knowledge needed to follow the discussion. */
  background: string
  /** References for further reading. */
  sources: InsightSource[]
  /** Language of the explanation. */
  language: LanguageInsight
  /** Creation time (epoch ms). */
  createdAt: number
  /** Time the first content appeared (epoch ms). */
  firstContentAt: number | null
}

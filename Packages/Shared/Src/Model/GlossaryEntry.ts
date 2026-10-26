// Shared glossary of terms that came up in the meeting.
import type { LanguageInsight } from './Language'

/** A term with a one-line definition, collected from catch-up insights. */
export interface GlossaryEntry {
  /** The term as spoken. */
  term: string
  /** One-line plain definition. */
  definition: string
  /** Language of the definition. */
  language: LanguageInsight
  /** Insight that explains the term in depth, if any. */
  insightId: string | null
  /** Creation time (epoch ms). */
  createdAt: number
}

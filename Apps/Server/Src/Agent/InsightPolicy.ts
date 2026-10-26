// Decides which proposed insights reach participants: enabled kinds, proactivity, duplicates, rate.
import {
  getUrgencyThreshold,
  type DocumentBoard,
  type InsightKind,
  type InsightOrigin,
  type Proactivity,
} from '@ekklesiazous/shared'
import { computeSimilarity, normalizeText } from './TextSimilarity'

const DUPLICATE_SIMILARITY = 0.5
const DUPLICATE_WINDOW_MS = 20 * 60_000
const RATE_WINDOW_MS = 60_000
/** Default per-minute caps on proactive insights, by proactivity. */
export const RATE_LIMITS_DEFAULT: Record<Proactivity, number> = {
  off: 0,
  low: 2,
  medium: 3,
  high: 6,
}
// important items are never dropped by the rate cap; it only thins out nice-to-know cards
const RATE_EXEMPT_URGENCY = 0.8

/** The parts of a proposal the policy looks at. */
export interface InsightCandidate {
  /** Insight kind. */
  kind: InsightKind
  /** Card title. */
  title: string
  /** Search query. */
  query: string
  /** Term for catch-up cards. */
  term: string
  /** Urgency 0..1. */
  urgency: number
  /** Why the insight would exist. */
  origin: InsightOrigin
}

/** Outcome of an admission check. */
export type AdmissionVerdict =
  | { isAdmitted: true }
  | { isAdmitted: false; reason: 'kindDisabled' | 'belowThreshold' | 'duplicate' | 'rateLimited' }

/** Admission control for new insights. */
export class InsightPolicy {
  private readonly releasedAt: number[] = []
  private readonly candidatesPending: InsightCandidate[] = []

  /**
   * @param board - Board holding settings and existing insights.
   * @param rateLimits - Per-minute caps on proactive insights.
   * @param now - Clock (injectable for tests).
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly rateLimits: Record<Proactivity, number> = RATE_LIMITS_DEFAULT,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Checks a candidate and, when admitted, remembers it so later duplicates are caught.
   *
   * @param candidate - The proposed insight.
   */
  admit(candidate: InsightCandidate): AdmissionVerdict {
    const meta = this.board.readMeta()
    const isProactive = candidate.origin === 'proactive'
    if (isProactive && !meta.kindsEnabled[candidate.kind]) {
      return { isAdmitted: false, reason: 'kindDisabled' }
    }
    if (isProactive && candidate.urgency < getUrgencyThreshold(meta.proactivity)) {
      return { isAdmitted: false, reason: 'belowThreshold' }
    }
    if (this.isDuplicate(candidate)) return { isAdmitted: false, reason: 'duplicate' }
    const isCapped = isProactive && candidate.urgency < RATE_EXEMPT_URGENCY
    if (isCapped && this.countRecentReleases() >= this.rateLimits[meta.proactivity]) {
      return { isAdmitted: false, reason: 'rateLimited' }
    }
    this.candidatesPending.push(candidate)
    if (this.candidatesPending.length > 50) this.candidatesPending.shift()
    if (isProactive) this.releasedAt.push(this.now())
    return { isAdmitted: true }
  }

  private isDuplicate(candidate: InsightCandidate): boolean {
    const now = this.now()
    const termNormalized = normalizeText(candidate.term)
    if (candidate.kind === 'catchUp' && termNormalized.length > 0) {
      const isKnown = this.board
        .listGlossary()
        .some((entry) => normalizeText(entry.term) === termNormalized)
      if (isKnown) return true
    }
    const existing: InsightCandidate[] = [
      ...this.candidatesPending,
      ...this.board
        .listInsights()
        .filter((insight) => now - insight.createdAt <= DUPLICATE_WINDOW_MS)
        .map((insight) => ({
          kind: insight.kind,
          title: insight.title,
          query: insight.query,
          term: '',
          urgency: insight.urgency,
          origin: insight.origin,
        })),
    ]
    return existing.some((other) => {
      if (other.kind !== candidate.kind) return false
      if (termNormalized.length > 0 && normalizeText(other.term) === termNormalized) return true
      return (
        computeSimilarity(other.title, candidate.title) >= DUPLICATE_SIMILARITY ||
        computeSimilarity(other.query, candidate.query) >= DUPLICATE_SIMILARITY
      )
    })
  }

  private countRecentReleases(): number {
    const cutoff = this.now() - RATE_WINDOW_MS
    while (this.releasedAt.length > 0 && this.releasedAt[0]! < cutoff) this.releasedAt.shift()
    return this.releasedAt.length
  }
}

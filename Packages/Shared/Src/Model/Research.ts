// Research intensity settings shared by explicit commands and proactive research.

/**
 * How much effort one research task spends.
 *
 * - `quick`: one query, fastest search, fast model (target: under 3 seconds).
 * - `standard`: bilingual queries fanned out to several sources (target: under 6 seconds).
 * - `deep`: planned sub-queries, page contents and the deep model (tens of seconds, shows progress).
 */
export type ResearchDepth = 'quick' | 'standard' | 'deep'

/** Every research depth, from lightest to heaviest. */
export const RESEARCH_DEPTHS: readonly ResearchDepth[] = ['quick', 'standard', 'deep']

/**
 * How eagerly the agent volunteers insights nobody asked for.
 *
 * - `off`: only explicit commands and clarifications.
 * - `low`: only highly urgent insights (likely reinvention, clear factual errors).
 * - `medium`: balanced default.
 * - `high`: anything that may help, including minor terms.
 */
export type Proactivity = 'off' | 'low' | 'medium' | 'high'

/** Every proactivity level, from quietest to most talkative. */
export const PROACTIVITY_LEVELS: readonly Proactivity[] = ['off', 'low', 'medium', 'high']

/**
 * Minimum urgency (0..1) a proactive insight needs at each proactivity level.
 *
 * @param proactivity - Room-level proactivity.
 */
export function getUrgencyThreshold(proactivity: Proactivity): number {
  switch (proactivity) {
    case 'off':
      return Number.POSITIVE_INFINITY
    case 'low':
      return 0.75
    case 'medium':
      return 0.5
    case 'high':
      return 0.25
  }
}

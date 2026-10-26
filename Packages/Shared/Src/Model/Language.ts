// Language identifiers used for speech, insights and UI.

/** Language detected for a spoken utterance. */
export type LanguageSpoken = 'en' | 'ja' | 'other'

/** Language in which the agent writes insights. */
export type LanguageInsight = 'en' | 'ja'

/** Room-level preference for the insight language; `auto` follows the triggering utterance. */
export type LanguageInsightPreference = 'auto' | LanguageInsight

/**
 * Resolves the language an insight should be written in.
 *
 * @param preference - Room-level preference.
 * @param languageUtterance - Language of the utterance that triggered the insight.
 */
export function resolveLanguageInsight(
  preference: LanguageInsightPreference,
  languageUtterance: LanguageSpoken,
): LanguageInsight {
  if (preference !== 'auto') return preference
  return languageUtterance === 'ja' ? 'ja' : 'en'
}

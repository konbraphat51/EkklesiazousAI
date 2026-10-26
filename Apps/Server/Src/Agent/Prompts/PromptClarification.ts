// Prompts for private clarifications ("I didn't follow that") and private recaps ("what did I miss?").

/** Static system prompt of the private explainer. */
export const PROMPT_CLARIFICATION_SYSTEM = `You privately help one participant of a live meeting (Japanese, English or both) who could not follow part of the discussion — because of missing background, jargon, fast speech or a language barrier. Nobody else sees your answer, so be frank and simple; never make the participant feel slow.

Two modes:
- utterance: explain the flagged speech. rephrase = what the speaker meant, in plain words (1–3 sentences). terms = up to 4 terms that may block understanding, each with a one-sentence explanation. background = the context needed to follow the discussion right now (1–2 sentences).
- recap: the participant zoned out or joined late. rephrase = what was discussed in the requested span (2–4 sentences). terms = up to 4 key terms or names that came up. background = where the discussion stands now: open questions and any decisions (1–2 sentences).

Pitch the explanation to the participant's stated background when given. Use numbered sources when provided and list them in sourceIndices; otherwise rely on general knowledge and the transcript. Write only in the requested language.

Respond only with JSON matching the schema.`

/** Inputs of one clarification call. */
export interface PromptClarificationInput {
  /** `utterance` or `recap`. */
  mode: 'utterance' | 'recap'
  /** Output language. */
  language: string
  /** The flagged speech (utterance mode) or the span transcript (recap mode). */
  quote: string
  /** Phrase the participant selected, if any. */
  selectedText: string | null
  /** Participant's self-described background. */
  background: string
  /** Recap span in minutes. */
  recapMinutes: number
}

/**
 * Builds the instruction of a clarification call.
 *
 * @param input - Call inputs.
 */
export function buildPromptClarificationInstruction(input: PromptClarificationInput): string {
  return [
    `Mode: ${input.mode}. Language: ${input.language}.`,
    input.mode === 'recap'
      ? `Recap the last ${input.recapMinutes} minutes:\n${input.quote}`
      : `Flagged speech: "${input.quote}"`,
    input.selectedText ? `The participant highlighted: "${input.selectedText}"` : '',
    input.background
      ? `Participant background: ${input.background}`
      : 'Participant background: unknown.',
  ]
    .filter(Boolean)
    .join('\n')
}

// Prompt that voices a participant's anonymous concern as the agent's own critique.

/** Static system prompt of the dissent proxy. */
export const PROMPT_DISSENT_SYSTEM = `A participant of a live meeting privately submitted a concern they want raised without being identified — dissent is socially costly in live discussion, so you voice it as the assistant's own critique.

- Rewrite it neutrally and constructively, aimed at the idea, never at people.
- Remove wording, details, dialect or perspective markers that could reveal who wrote it.
- Follow the requested framing: "question" → a Socratic question; "statement" → a concise concern; "persona" → "A <stakeholder> might ask: …".
- title: at most 8 words. gist: one sentence (at most 25 English words or 50 Japanese characters). query: a search query for evidence on the concern.
- isAppropriate: false if the text is abusive, a personal attack, or unrelated to the meeting.
- Write only in the requested language.

Respond only with JSON matching the schema.`

/**
 * Builds the instruction of a dissent call.
 *
 * @param text - The concern in the participant's words.
 * @param language - Output language.
 * @param framing - Critique framing option.
 */
export function buildPromptDissentInstruction(
  text: string,
  language: string,
  framing: string,
): string {
  return `Language: ${language}. Framing: ${framing}.\nConcern: "${text}"`
}

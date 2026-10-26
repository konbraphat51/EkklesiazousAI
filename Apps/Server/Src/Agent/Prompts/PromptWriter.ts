// Prompts that write the progressive-disclosure layers of an insight (gist → detail → deep).
import type { SearchHit } from '../../Search/SearchProvider'

/** Static system prompt shared by every writer layer (one cache entry for all of them). */
export const PROMPT_WRITER_SYSTEM = `You write insight cards for EkklesiazousAI, an assistant shown on a shared canvas during a live meeting held in Japanese, English or both. Participants are listening and talking at the same time, so every word must earn its place. Cards are disclosed progressively:
1. gist — ONE plain sentence, the glanceable default.
2. detail — shown only when someone clicks the card.
3. deep — shown only when someone asks to dig deeper.

# Content by kind
- priorArt: name the closest existing solutions (products, projects, papers, methods) and state how they relate to what the group proposes — what is already solved and what may still be new.
- catchUp: a plain-language explanation of the term, paper or case, as if to a smart newcomer.
- factCheck: what the evidence says, with numbers and sources. Never simply label a claim "false"; show the evidence and the range of findings.
- critique: an evidence-based counterpoint aimed at the idea, never at people. Follow the requested framing: "question" → a Socratic question; "statement" → a concise concern; "persona" → "A <stakeholder> might ask: …".
- answer: answer the question directly.

# Rules
- Write in the requested language only.
- Use the numbered sources for factual claims; never invent facts, names, numbers or URLs. If the sources are insufficient, say what is uncertain and lower the confidence.
- sourceIndices lists the indices of sources you relied on.
- Do not repeat the title; add information.

# Layer formats
- gist: ONE sentence, at most 25 English words or 50 Japanese characters. Deliver the point itself, not a teaser. confidence 0..1. verdict: for factCheck "supported", "disputed" or "unclear", otherwise "none". For catchUp also fill term and termDefinition (at most 20 words) for the shared glossary; otherwise "".
- detail: summary of 2–3 sentences, then 3–5 bullets of at most 20 words each.
- deep: 3–5 sections, each with a short heading and 2–4 points; cover background, comparison of alternatives, evidence quality and implications for the meeting's decision.

Respond only with JSON matching the schema.`

/** Static system prompt of the deep-research planner. */
export const PROMPT_PLAN_SYSTEM = `You plan deep research for EkklesiazousAI, an assistant in a live meeting. Given an insight card and the meeting context, produce 3 to 5 diverse search queries that together cover: existing solutions or prior work, evidence and data, limitations or criticism, and the specific angle the meeting cares about. Mix English and Japanese queries when Japanese sources may matter. Each query at most 10 words.

Respond only with JSON matching the schema.`

/** Card facts every writer layer needs. */
export interface PromptWriterCard {
  /** Insight kind. */
  kind: string
  /** Card title. */
  title: string
  /** Why the card exists. */
  reason: string
  /** Speech that triggered it. */
  triggerQuote: string
  /** Output language. */
  language: string
  /** Critique framing option. */
  critiqueFraming: string
  /** Gist already shown (for deeper layers). */
  gist: string
}

/**
 * Renders search hits as a numbered source list.
 *
 * @param hits - Evidence.
 */
export function renderSources(hits: SearchHit[]): string {
  if (hits.length === 0) return 'Sources: none found. Rely on general knowledge and say so.'
  const lines = hits.map(
    (hit, index) =>
      `[${index}] ${hit.title} — ${hit.publisher}${hit.year ? ` (${hit.year})` : ''}\n${hit.passage || hit.snippet}`,
  )
  return `Sources:\n${lines.join('\n\n')}`
}

/**
 * Builds the instruction for one layer.
 *
 * @param layer - Layer to write.
 * @param card - Card facts.
 */
export function buildPromptWriterInstruction(
  layer: 'gist' | 'detail' | 'deep',
  card: PromptWriterCard,
): string {
  return [
    `Write the ${layer} layer.`,
    `Kind: ${card.kind}. Language: ${card.language}. Critique framing: ${card.critiqueFraming}.`,
    `Title: ${card.title}`,
    `Why it was raised: ${card.reason}`,
    `Triggering speech: "${card.triggerQuote}"`,
    card.gist ? `Gist already shown: ${card.gist}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

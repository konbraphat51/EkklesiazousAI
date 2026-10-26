// Voices participants' anonymous concerns as the agent's own critiques ("the hidden one in the assembly").
import type { LanguageInsight, UxOption } from '@ekklesiazous/shared'
import type { LanguageModel } from '../Llm/LanguageModel'
import { dissentSchema, type DissentOutput } from './AgentSchemas'
import type { MeetingContext } from './MeetingContext'
import { PROMPT_DISSENT_SYSTEM, buildPromptDissentInstruction } from './Prompts/PromptDissent'

const RATE_WINDOW_MS = 5 * 60_000
const RATE_LIMIT = 3

/** Rewrites anonymous concerns, with per-participant rate limiting. */
export class DissentService {
  private readonly submittedAt = new Map<string, number[]>()

  /**
   * @param context - Meeting context.
   * @param model - Fast writer model.
   */
  constructor(
    private readonly context: MeetingContext,
    private readonly model: LanguageModel,
  ) {}

  /**
   * Rewrites a concern.
   *
   * @param text - The concern.
   * @param participantId - Pseudonymous id (rate limiting only).
   * @param language - Output language.
   * @param framing - Critique framing.
   * @returns The rewrite, or null when rate limited.
   */
  async rewrite(
    text: string,
    participantId: string,
    language: LanguageInsight,
    framing: UxOption<'critiqueFraming'>,
  ): Promise<DissentOutput | null> {
    const now = Date.now()
    const recent = (this.submittedAt.get(participantId) ?? []).filter(
      (at) => now - at <= RATE_WINDOW_MS,
    )
    if (recent.length >= RATE_LIMIT) return null
    this.submittedAt.set(participantId, [...recent, now])

    return this.model.generate({
      task: 'dissent',
      hints: { text },
      prompt: {
        system: PROMPT_DISSENT_SYSTEM,
        contextBlocks: [this.context.renderRecent(12)],
        cacheIndex: -1,
        instruction: buildPromptDissentInstruction(
          text.slice(0, 1000),
          language === 'ja' ? 'Japanese' : 'English',
          framing,
        ),
      },
      schema: dissentSchema,
      maxTokens: 500,
    })
  }
}

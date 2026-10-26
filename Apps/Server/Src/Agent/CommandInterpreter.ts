// Turns explicit research requests (typed or spoken after a wake word) into research proposals.
import type { LanguageInsight } from '@ekklesiazous/shared'
import type { LanguageModel } from '../Llm/LanguageModel'
import { commandSchema, type Proposal } from './AgentSchemas'
import type { MeetingContext } from './MeetingContext'
import { PROMPT_COMMAND_SYSTEM, buildPromptCommandInstruction } from './Prompts/PromptCommand'

/** Interprets explicit commands with the fast model. */
export class CommandInterpreter {
  /**
   * @param context - Meeting context (to resolve references like "that tool").
   * @param model - Fast model.
   */
  constructor(
    private readonly context: MeetingContext,
    private readonly model: LanguageModel,
  ) {}

  /**
   * Interprets a request.
   *
   * @param text - The request.
   * @param language - Language of the resulting card.
   * @param signal - Cancels the call.
   * @returns A proposal, or null when the text is not a research request.
   */
  async interpret(
    text: string,
    language: LanguageInsight,
    signal?: AbortSignal,
  ): Promise<Proposal | null> {
    const output = await this.model.generate({
      task: 'command',
      hints: { text },
      prompt: {
        system: PROMPT_COMMAND_SYSTEM,
        contextBlocks: [this.context.renderRecent(12), this.context.renderState()],
        cacheIndex: -1,
        instruction: buildPromptCommandInstruction(
          text,
          language === 'ja' ? 'Japanese' : 'English',
        ),
      },
      schema: commandSchema,
      maxTokens: 600,
      signal,
    })
    if (!output.isResearchRequest) return null
    return {
      ...output.proposal,
      pattern: 'explicitRequest',
      urgency: Math.max(0.9, output.proposal.urgency),
    }
  }
}

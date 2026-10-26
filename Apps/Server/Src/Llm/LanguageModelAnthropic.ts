// Claude implementation of LanguageModel: structured outputs, prompt caching and partial streaming.
import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { parseJsonPartial } from './JsonPartialParser'
import {
  LanguageModelError,
  type GenerationRequest,
  type LanguageModel,
  type PromptLayered,
} from './LanguageModel'

/** Reasoning effort levels accepted by current Claude models. */
export type EffortLevel = 'low' | 'medium' | 'high'

/** Tuning of one Claude-backed model role. */
export interface LanguageModelAnthropicOptions {
  /** Claude model id, e.g. `claude-haiku-5-5`. */
  modelId: string
  /** Reasoning effort; `low` for latency-critical roles. */
  effort: EffortLevel
  /** Whether the model may think before answering (ignored by models that always think). */
  isThinkingWanted: boolean
}

const PARTIAL_INTERVAL_MS = 60

/** Streams schema-constrained JSON from Claude. */
export class LanguageModelAnthropic implements LanguageModel {
  /** Claude model id. */
  readonly modelId: string

  /**
   * @param client - Shared Anthropic client.
   * @param options - Model role tuning.
   */
  constructor(
    private readonly client: Anthropic,
    private readonly options: LanguageModelAnthropicOptions,
  ) {
    this.modelId = options.modelId
  }

  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const fallback = hasServerFallback(this.modelId)
    const stream = this.client.beta.messages.stream(
      {
        model: this.modelId,
        max_tokens: request.maxTokens,
        system: [
          { type: 'text', text: request.prompt.system, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: renderContent(request.prompt) }],
        output_config: { format: zodOutputFormat(request.schema), effort: this.options.effort },
        ...buildThinking(this.modelId, this.options.isThinkingWanted),
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      },
      { signal: request.signal },
    )

    // emit throttled partial parses so cards fill in while the JSON streams
    let text = ''
    let lastPartialAt = 0
    stream.on('text', (delta) => {
      text += delta
      const now = Date.now()
      if (!request.onPartial || now - lastPartialAt < PARTIAL_INTERVAL_MS) return
      lastPartialAt = now
      const partial = parseJsonPartial(text)
      if (partial !== undefined) request.onPartial(partial)
    })

    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') {
      throw new LanguageModelError('refusal', `${this.modelId} declined the request`)
    }
    if (message.stop_reason === 'max_tokens') {
      throw new LanguageModelError('truncated', `${this.modelId} hit max_tokens`)
    }
    const output = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
    const parsed = request.schema.safeParse(safeJsonParse(output))
    if (!parsed.success) {
      throw new LanguageModelError('invalid', `${this.modelId} returned invalid JSON`)
    }
    request.onPartial?.(parsed.data)
    return parsed.data
  }
}

function renderContent(prompt: PromptLayered): Anthropic.Beta.BetaTextBlockParam[] {
  const blocks: Anthropic.Beta.BetaTextBlockParam[] = prompt.contextBlocks
    .filter((text) => text.length > 0)
    .map((text) => ({ type: 'text', text }))
  const cacheIndex = Math.min(prompt.cacheIndex, blocks.length - 1)
  const cached = blocks[cacheIndex]
  if (cacheIndex >= 0 && cached)
    blocks[cacheIndex] = { ...cached, cache_control: { type: 'ephemeral' } }
  blocks.push({ type: 'text', text: prompt.instruction })
  return blocks
}

// Haiku can switch thinking off; Sonnet 5.5 uses `between_tools` for that; Opus/Fable always think
function buildThinking(
  modelId: string,
  isThinkingWanted: boolean,
): { thinking?: Anthropic.Beta.BetaThinkingConfigParam } {
  if (modelId.startsWith('claude-haiku-5')) {
    return { thinking: isThinkingWanted ? { type: 'adaptive' } : { type: 'disabled' } }
  }
  if (modelId.startsWith('claude-sonnet-5-5')) {
    return { thinking: isThinkingWanted ? { type: 'adaptive' } : { type: 'between_tools' } }
  }
  return {}
}

function hasServerFallback(modelId: string): boolean {
  return ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1'].some(
    (prefix) => modelId === prefix,
  )
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

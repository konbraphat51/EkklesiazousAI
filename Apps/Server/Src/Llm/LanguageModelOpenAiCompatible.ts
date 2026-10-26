// OpenAI-compatible chat-completions client for ultra-fast inference hosts (Cerebras, Groq).
import { toJsonSchemaStrict } from './JsonSchemaStrict'
import { LanguageModelError, type GenerationRequest, type LanguageModel } from './LanguageModel'

/** Connection settings of an OpenAI-compatible host. */
export interface LanguageModelOpenAiCompatibleOptions {
  /** Provider name for logs, e.g. `cerebras`. */
  provider: string
  /** API base URL ending in `/v1`. */
  baseUrl: string
  /** API key. */
  apiKey: string
  /** Model id on the host. */
  modelId: string
  /** Reasoning effort for reasoning models such as gpt-oss; null to omit the field. */
  reasoningEffort: 'low' | 'medium' | 'high' | null
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
}

/** Strict-JSON generation on an OpenAI-compatible endpoint (non-streaming; used for routing). */
export class LanguageModelOpenAiCompatible implements LanguageModel {
  /** Model id, prefixed with the provider for clarity in logs. */
  readonly modelId: string

  /**
   * @param options - Host, credentials and model.
   */
  constructor(private readonly options: LanguageModelOpenAiCompatibleOptions) {
    this.modelId = `${options.provider}/${options.modelId}`
  }

  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const userContent = [...request.prompt.contextBlocks, request.prompt.instruction]
      .filter((text) => text.length > 0)
      .join('\n\n')
    const body = {
      model: this.options.modelId,
      messages: [
        { role: 'system', content: request.prompt.system },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: request.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.task,
          strict: true,
          schema: toJsonSchemaStrict(request.schema),
        },
      },
      ...(this.options.reasoningEffort ? { reasoning_effort: this.options.reasoningEffort } : {}),
    }
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })
    if (!response.ok) {
      throw new Error(`${this.modelId} failed: ${response.status} ${await response.text()}`)
    }
    const completion = (await response.json()) as ChatCompletionResponse
    const choice = completion.choices?.[0]
    if (choice?.finish_reason === 'length') {
      throw new LanguageModelError('truncated', `${this.modelId} hit the token limit`)
    }
    let value: unknown
    try {
      value = JSON.parse(choice?.message?.content ?? '')
    } catch {
      throw new LanguageModelError('invalid', `${this.modelId} returned malformed JSON`)
    }
    const parsed = request.schema.safeParse(value)
    if (!parsed.success) {
      throw new LanguageModelError('invalid', `${this.modelId} returned off-schema JSON`)
    }
    request.onPartial?.(parsed.data)
    return parsed.data
  }
}

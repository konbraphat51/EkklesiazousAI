// OpenAI implementation of LanguageModel: Responses API with strict structured outputs and streaming.
import { parseJsonPartial } from './JsonPartialParser'
import { toJsonSchemaStrict } from './JsonSchemaStrict'
import { LanguageModelError, type GenerationRequest, type LanguageModel } from './LanguageModel'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const PARTIAL_INTERVAL_MS = 60

/** Reasoning effort accepted by the Responses API. */
export type OpenAiReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high'

/** Tuning of one OpenAI-backed model role. */
export interface LanguageModelOpenAiOptions {
  /** API key. */
  apiKey: string
  /** Model id, e.g. `gpt-6-luna`. */
  modelId: string
  /** Reasoning effort; `none` for latency-critical roles. */
  reasoningEffort: OpenAiReasoningEffort
  /** API base URL (override for proxies). */
  baseUrl?: string
}

/** Server-sent event of the Responses API (only the fields used here). */
interface ResponsesEvent {
  type: string
  delta?: string
  response?: { incomplete_details?: { reason?: string } | null }
  error?: { message?: string } | null
  message?: string
}

/** Streams schema-constrained JSON from OpenAI. */
export class LanguageModelOpenAi implements LanguageModel {
  /** OpenAI model id. */
  readonly modelId: string

  /**
   * @param options - Credentials, model and reasoning effort.
   */
  constructor(private readonly options: LanguageModelOpenAiOptions) {
    this.modelId = options.modelId
  }

  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const input = [...request.prompt.contextBlocks, request.prompt.instruction]
      .filter((text) => text.length > 0)
      .join('\n\n')
    const response = await fetch(this.options.baseUrl ?? OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.modelId,
        // stable instructions first: OpenAI caches the prompt prefix automatically
        instructions: request.prompt.system,
        input,
        max_output_tokens: request.maxTokens,
        reasoning: { effort: this.options.reasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: request.task,
            strict: true,
            schema: toJsonSchemaStrict(request.schema),
          },
        },
        stream: true,
      }),
      signal: request.signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`${this.modelId} failed: ${response.status} ${await response.text()}`)
    }

    let text = ''
    let lastPartialAt = 0
    for await (const event of readServerSentEvents(response.body)) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        text += event.delta
        const now = Date.now()
        if (request.onPartial && now - lastPartialAt >= PARTIAL_INTERVAL_MS) {
          lastPartialAt = now
          const partial = parseJsonPartial(text)
          if (partial !== undefined) request.onPartial(partial)
        }
      } else if (event.type === 'response.refusal.delta') {
        throw new LanguageModelError('refusal', `${this.modelId} declined the request`)
      } else if (event.type === 'response.incomplete') {
        throw new LanguageModelError('truncated', `${this.modelId} stopped early`)
      } else if (event.type === 'response.failed' || event.type === 'error') {
        throw new Error(`${this.modelId} failed: ${event.error?.message ?? event.message ?? ''}`)
      }
    }

    let value: unknown
    try {
      value = JSON.parse(text)
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

/**
 * Parses a server-sent-event stream into JSON events.
 *
 * @param body - Response body.
 */
export async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ResponsesEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data) as ResponsesEvent
      } catch {
        // ignore keep-alive or malformed lines
      }
    }
  }
}

// Tests for the OpenAI Responses streaming client against a stubbed fetch.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LanguageModelOpenAi } from './LanguageModelOpenAi'
import { LanguageModelError } from './LanguageModel'

function streamOf(events: object[]): ReadableStream<Uint8Array> {
  const text = events.map((event) => `event: x\ndata: ${JSON.stringify(event)}\n\n`).join('')
  return new ReadableStream({
    start(controller) {
      // split mid-event to exercise buffering
      const bytes = new TextEncoder().encode(text)
      controller.enqueue(bytes.slice(0, 30))
      controller.enqueue(bytes.slice(30))
      controller.close()
    },
  })
}

const request = {
  task: 'gist' as const,
  hints: {},
  prompt: { system: 'sys', contextBlocks: ['ctx'], cacheIndex: -1, instruction: 'do' },
  schema: z.object({ gist: z.string() }),
  maxTokens: 100,
}

afterEach(() => vi.unstubAllGlobals())

describe('LanguageModelOpenAi', () => {
  it('streams text deltas into partial parses and returns the validated object', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          streamOf([
            { type: 'response.output_text.delta', delta: '{"gist":"Hel' },
            { type: 'response.output_text.delta', delta: 'lo"}' },
            { type: 'response.completed', response: {} },
          ]),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const partials: unknown[] = []
    const model = new LanguageModelOpenAi({
      apiKey: 'k',
      modelId: 'gpt-6-luna',
      reasoningEffort: 'none',
    })
    const result = await model.generate({
      ...request,
      onPartial: (partial) => partials.push(partial),
    })
    expect(result).toEqual({ gist: 'Hello' })
    expect(partials.at(-1)).toEqual({ gist: 'Hello' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as unknown
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      instructions: 'sys',
      input: 'ctx\n\ndo',
      reasoning: { effort: 'none' },
      text: { format: { type: 'json_schema', name: 'gist', strict: true } },
      stream: true,
    })
  })

  it('reports refusals and truncation', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(streamOf([{ type: 'response.refusal.delta', delta: 'no' }])),
    )
    const model = new LanguageModelOpenAi({ apiKey: 'k', modelId: 'm', reasoningEffort: 'none' })
    await expect(model.generate(request)).rejects.toBeInstanceOf(LanguageModelError)
    vi.stubGlobal(
      'fetch',
      async () => new Response(streamOf([{ type: 'response.incomplete', response: {} }])),
    )
    await expect(model.generate(request)).rejects.toThrow('stopped early')
  })
})

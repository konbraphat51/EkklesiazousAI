// Tests for hedged generation and strict JSON-schema conversion.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LanguageModelHedged } from './LanguageModelHedged'
import { toJsonSchemaStrict } from './JsonSchemaStrict'
import type { GenerationRequest, LanguageModel } from './LanguageModel'

function model(id: string, delayMs: number, isFailing = false): LanguageModel & { calls: number } {
  const instance = {
    modelId: id,
    calls: 0,
    generate<T>(request: GenerationRequest<T>): Promise<T> {
      instance.calls += 1
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (isFailing) reject(new Error(`${id} failed`))
          else resolve({ by: id } as T)
        }, delayMs)
        request.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    },
  }
  return instance
}

const request: GenerationRequest<{ by: string }> = {
  task: 'trigger',
  hints: {},
  prompt: { system: '', contextBlocks: [], cacheIndex: -1, instruction: '' },
  schema: z.object({ by: z.string() }),
  maxTokens: 10,
}

describe('LanguageModelHedged', () => {
  it('does not start the backup when the primary answers quickly', async () => {
    const primary = model('primary', 5)
    const backup = model('backup', 5)
    const result = await new LanguageModelHedged(primary, backup, 50).generate(request)
    expect(result.by).toBe('primary')
    expect(backup.calls).toBe(0)
  })

  it('lets a faster backup win when the primary is slow', async () => {
    const result = await new LanguageModelHedged(
      model('primary', 300),
      model('backup', 5),
      20,
    ).generate(request)
    expect(result.by).toBe('backup')
  })

  it('starts the backup immediately when the primary fails', async () => {
    const result = await new LanguageModelHedged(
      model('primary', 1, true),
      model('backup', 5),
      10_000,
    ).generate(request)
    expect(result.by).toBe('backup')
  })

  it('rejects when both fail', async () => {
    await expect(
      new LanguageModelHedged(model('a', 1, true), model('b', 1, true), 5).generate(request),
    ).rejects.toThrow('a failed')
  })
})

describe('toJsonSchemaStrict', () => {
  it('closes objects, requires all properties and drops unsupported keywords', () => {
    const schema = toJsonSchemaStrict(
      z.object({
        name: z.string().min(1),
        tags: z.array(z.object({ v: z.number().max(1) })).max(3),
      }),
    )
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['name', 'tags'],
      properties: {
        name: { type: 'string' },
        tags: { type: 'array', items: { additionalProperties: false, required: ['v'] } },
      },
    })
    expect(JSON.stringify(schema)).not.toMatch(/minLength|maxItems|maximum|\$schema/)
  })
})

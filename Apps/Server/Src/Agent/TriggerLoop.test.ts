// Tests for wake-word command extraction.
import { describe, expect, it } from 'vitest'
import { extractCommand } from './TriggerLoop'
import { normalizeText } from './TextSimilarity'

const wakeWords = ['ekklesia', 'エクレシア', 'hey ai'].map(normalizeText)

describe('extractCommand', () => {
  it('returns null when the agent is not addressed', () => {
    expect(extractCommand('I think we should build our own tool', wakeWords)).toBeNull()
  })

  it('extracts the request after an English wake word', () => {
    expect(extractCommand('Hey, Ekklesia, look up prior work on hidden profiles.', wakeWords)).toBe(
      'look up prior work on hidden profiles.',
    )
    expect(extractCommand('hey AI: what is RAG?', wakeWords)).toBe('what is RAG?')
  })

  it('extracts the request after a Japanese wake word', () => {
    expect(extractCommand('エクレシア、議事録AIの既存サービスを詳しく調べて', wakeWords)).toBe(
      '議事録AIの既存サービスを詳しく調べて',
    )
  })
})

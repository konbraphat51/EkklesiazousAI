// Tests for admission control, text similarity and transcript chunking.
import { describe, expect, it } from 'vitest'
import { DocumentBoard } from '@ekklesiazous/shared'
import { InsightPolicy, type InsightCandidate } from './InsightPolicy'
import { computeSimilarity } from './TextSimilarity'
import { MeetingContext } from './MeetingContext'

function candidate(overrides: Partial<InsightCandidate> = {}): InsightCandidate {
  return {
    kind: 'priorArt',
    title: 'Existing tool: Otter live notes',
    query: 'real-time meeting transcription assistant',
    term: '',
    urgency: 0.8,
    origin: 'proactive',
    ...overrides,
  }
}

describe('computeSimilarity', () => {
  it('scores near-duplicates high in English and Japanese', () => {
    expect(computeSimilarity('Otter.ai live notes', 'otter ai live-notes')).toBe(1)
    expect(computeSimilarity('隠れたプロファイル課題', '隠れたプロファイル')).toBeGreaterThan(0.7)
    expect(computeSimilarity('Whisper streaming', '議題の整理')).toBe(0)
  })
})

describe('InsightPolicy', () => {
  it('rejects disabled kinds and low urgency for proactive insights only', () => {
    const board = new DocumentBoard()
    board.patchMeta({ kindsEnabled: { critique: false } as never, proactivity: 'low' })
    const policy = new InsightPolicy(board)
    expect(policy.admit(candidate({ kind: 'critique' }))).toEqual({
      isAdmitted: false,
      reason: 'kindDisabled',
    })
    expect(policy.admit(candidate({ urgency: 0.5 }))).toEqual({
      isAdmitted: false,
      reason: 'belowThreshold',
    })
    expect(policy.admit(candidate({ urgency: 0.1, origin: 'command' })).isAdmitted).toBe(true)
  })

  it('rejects duplicates by title, query and catch-up term', () => {
    const board = new DocumentBoard()
    const policy = new InsightPolicy(board)
    expect(policy.admit(candidate()).isAdmitted).toBe(true)
    expect(policy.admit(candidate({ title: 'Existing tool: Otter live notes!' }))).toMatchObject({
      reason: 'duplicate',
    })
    board.upsertGlossary({
      term: 'RAG',
      definition: 'Retrieval-augmented generation',
      language: 'en',
      insightId: null,
      createdAt: 0,
    })
    expect(
      policy.admit(candidate({ kind: 'catchUp', term: 'rag', title: 'What is RAG', query: 'RAG' })),
    ).toMatchObject({ reason: 'duplicate' })
  })

  it('rate-limits nice-to-know proactive insights per minute', () => {
    const board = new DocumentBoard()
    board.patchMeta({ proactivity: 'medium' })
    const clock = { now: 0 }
    const policy = new InsightPolicy(board, undefined, () => clock.now)
    const minor = (title: string): InsightCandidate =>
      candidate({ title, query: title.repeat(3), urgency: 0.6 })
    expect(policy.admit(minor('a')).isAdmitted).toBe(true)
    expect(policy.admit(minor('b')).isAdmitted).toBe(true)
    expect(policy.admit(minor('c')).isAdmitted).toBe(true)
    expect(policy.admit(minor('d'))).toMatchObject({ reason: 'rateLimited' })
    // urgent items bypass the cap
    expect(policy.admit(candidate({ title: 'e', query: 'eee', urgency: 0.9 })).isAdmitted).toBe(
      true,
    )
    clock.now = 61_000
    expect(policy.admit(minor('f')).isAdmitted).toBe(true)
  })
})

describe('MeetingContext.renderTranscript', () => {
  it('splits into stable chunks of 20 and marks the last complete chunk cacheable', () => {
    const board = new DocumentBoard()
    for (let index = 0; index < 45; index++) {
      board.appendSegment({
        id: `s${index}`,
        speakerId: 'mic:1',
        text: `line ${index}`,
        language: 'en',
        sourceId: 'mic',
        startMs: index * 1000,
        endMs: index * 1000 + 500,
        finalizedAt: index,
      })
    }
    const rendered = new MeetingContext(board).renderTranscript()
    expect(rendered.blocks).toHaveLength(3)
    expect(rendered.cacheIndex).toBe(1)
    expect(rendered.blocks[0]).toContain('[s0] mic:1 00:00 line 0')

    const windowed = new MeetingContext(board).renderTranscript(30)
    expect(windowed.blocks[0]).toContain('[s20]')
  })
})

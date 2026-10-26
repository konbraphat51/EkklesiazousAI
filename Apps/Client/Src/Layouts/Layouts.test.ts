// Tests for the canvas layout strategies.
import { describe, expect, it } from 'vitest'
import type { Insight, IssueNode, Topic } from '@ekklesiazous/shared'
import { LayoutIssueMap } from './LayoutIssueMap'
import { LayoutTimeline, TIMELINE_PX_PER_SECOND } from './LayoutTimeline'
import { LayoutTopicMap } from './LayoutTopicMap'
import type { LayoutInput } from './LayoutTypes'

function insight(id: string, overrides: Partial<Insight> = {}): Insight {
  return {
    id,
    kind: 'priorArt',
    status: 'ready',
    topicId: null,
    issueNodeId: null,
    triggerPattern: 'newIdea',
    title: id,
    gist: '',
    detailStatus: 'none',
    summary: '',
    bullets: [],
    deepStatus: 'none',
    sections: [],
    sources: [],
    verdict: null,
    urgency: 0.5,
    confidence: 0.5,
    language: 'en',
    query: '',
    origin: 'proactive',
    depth: 'quick',
    progressNote: '',
    requesterName: null,
    reason: '',
    triggerSegmentIds: [],
    triggerQuote: '',
    createdAt: 0,
    updatedAt: 0,
    timings: {
      utteranceAt: 0,
      triggeredAt: 0,
      firstContentAt: null,
      readyAt: null,
      releasedAt: null,
      detailRequestedAt: null,
      detailReadyAt: null,
      deepRequestedAt: null,
      deepReadyAt: null,
      isSpeculative: false,
    },
    isPinned: false,
    votes: {},
    ...overrides,
  }
}

function input(overrides: Partial<LayoutInput>): LayoutInput {
  return {
    insights: [],
    segments: [],
    speakers: [],
    topics: [],
    issues: [],
    notes: [],
    placements: new Map(),
    meetingStartedAt: 0,
    now: 120_000,
    ...overrides,
  }
}

describe('LayoutTimeline', () => {
  it('anchors cards above their utterance time and uses the second row when crowded', () => {
    const result = new LayoutTimeline().compute(
      input({
        insights: [
          insight('a', { createdAt: 1, timings: { ...insight('x').timings, utteranceAt: 60_000 } }),
          insight('b', { createdAt: 2, timings: { ...insight('x').timings, utteranceAt: 61_000 } }),
        ],
      }),
    )
    const a = result.nodes.find((node) => node.id === 'insight:a')!
    const b = result.nodes.find((node) => node.id === 'insight:b')!
    expect(a.x + a.width / 2).toBe(60 * TIMELINE_PX_PER_SECOND)
    expect(a.y).toBeLessThan(0)
    expect(b.y).toBeLessThan(a.y)
    expect(b.x).toBeGreaterThanOrEqual(a.x)
    const axis = result.nodes.find((node) => node.id === 'timeAxis')!
    expect((axis.data.anchors as unknown[]).length).toBe(2)
  })

  it('applies manual placements and hides dismissed cards', () => {
    const result = new LayoutTimeline().compute(
      input({
        insights: [insight('a'), insight('gone', { status: 'dismissed' })],
        placements: new Map([['insight:a', { x: 5, y: 7 }]]),
      }),
    )
    expect(result.nodes.find((node) => node.id === 'insight:a')).toMatchObject({ x: 5, y: 7 })
    expect(result.nodes.some((node) => node.id === 'insight:gone')).toBe(false)
  })
})

describe('LayoutTopicMap', () => {
  it('puts cards inside their topic island and collects the rest in "other"', () => {
    const topics: Topic[] = [{ id: 't1', label: 'Cost', createdAt: 0, lastActiveAt: 0 }]
    const result = new LayoutTopicMap().compute(
      input({ topics, insights: [insight('a', { topicId: 't1' }), insight('b')] }),
    )
    const frame = result.nodes.find((node) => node.id === 'topic:t1')!
    const card = result.nodes.find((node) => node.id === 'insight:a')!
    expect(card.x).toBeGreaterThan(frame.x)
    expect(card.x + card.width).toBeLessThan(frame.x + frame.width)
    expect(card.y).toBeGreaterThan(frame.y)
    expect(result.nodes.some((node) => node.id === 'topic:__other__')).toBe(true)
  })
})

describe('LayoutIssueMap', () => {
  it('lays the tree out left to right and shows attached evidence as chips', () => {
    const node = (id: string, type: IssueNode['type'], parentId: string | null): IssueNode => ({
      id,
      type,
      text: id,
      parentId,
      topicId: null,
      speakerIds: [],
      isRaisedByAgent: true,
      isHumanEdited: false,
      createdAt: 0,
      updatedAt: 0,
    })
    const result = new LayoutIssueMap().compute(
      input({
        issues: [node('q', 'question', null), node('i', 'idea', 'q'), node('c', 'con', 'i')],
        insights: [insight('ev', { issueNodeId: 'i' }), insight('pool')],
      }),
    )
    const x = (id: string): number => result.nodes.find((item) => item.id === id)!.x
    expect(x('issue:q')).toBeLessThan(x('issue:i'))
    expect(x('issue:i')).toBeLessThan(x('issue:c'))
    expect(x('insight:ev')).toBeGreaterThan(x('issue:c'))
    expect(x('insight:pool')).toBe(x('insight:ev'))
    const idea = result.nodes.find((item) => item.id === 'issue:i')!
    expect(idea.data.chips).toEqual([{ insightId: 'ev', kind: 'priorArt', title: 'ev' }])
    expect(result.edges.map((edge) => edge.id)).toEqual(['edge:q:i', 'edge:i:c'])
  })
})

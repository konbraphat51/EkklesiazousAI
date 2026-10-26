// Tests for DocumentBoard: typed access, change notification and placement scoping.
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { DocumentBoard, type CollectionName } from './DocumentBoard'
import type { Insight } from '../Model/Insight'

function createInsight(id: string): Insight {
  return {
    id,
    kind: 'priorArt',
    status: 'researching',
    topicId: null,
    issueNodeId: null,
    triggerPattern: 'newIdea',
    title: 'Title',
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
    query: 'q',
    origin: 'proactive',
    depth: 'quick',
    progressNote: '',
    requesterName: null,
    reason: 'r',
    triggerSegmentIds: [],
    triggerQuote: '',
    createdAt: 1,
    updatedAt: 1,
    timings: {
      utteranceAt: 0,
      triggeredAt: 0,
      firstContentAt: null,
      readyAt: null,
      isSpeculative: false,
    },
    isPinned: false,
    votes: {},
  }
}

describe('DocumentBoard', () => {
  it('fills meta defaults and merges patches', () => {
    const board = new DocumentBoard()
    board.patchMeta({ title: 'Kickoff', kindsEnabled: { critique: false } as never })
    const meta = board.readMeta()
    expect(meta.title).toBe('Kickoff')
    expect(meta.uxSettings.layout).toBe('timeline')
    expect(meta.kindsEnabled.critique).toBe(false)
    expect(meta.kindsEnabled.priorArt).toBe(true)
  })

  it('patches insights and ignores missing ids', () => {
    const board = new DocumentBoard()
    board.upsertInsight(createInsight('a'))
    board.patchInsight('a', { summary: 'hello', status: 'ready' })
    board.patchInsight('missing', { summary: 'x' })
    expect(board.getInsight('a')?.summary).toBe('hello')
    expect(board.listInsights()).toHaveLength(1)
  })

  it('reports changed collections with the origin', () => {
    const board = new DocumentBoard()
    const events: Array<[Set<CollectionName>, unknown]> = []
    const unsubscribe = board.observe((changed, origin) => events.push([changed, origin]))
    board.upsertInsight(createInsight('a'))
    board.setCaption('mic', {
      sourceId: 'mic',
      speakerId: null,
      text: 'hi',
      language: 'en',
      updatedAt: 1,
    })
    unsubscribe()
    board.upsertInsight(createInsight('b'))
    expect(events).toHaveLength(2)
    expect([...events[0]![0]]).toEqual(['insights'])
    expect(events[0]![1]).toBe('agent')
  })

  it('scopes placements per layout', () => {
    const board = new DocumentBoard()
    board.setPlacement('timeline', 'card-1', { x: 10, y: 20 })
    board.setPlacement('issueMap', 'card-1', { x: 99, y: 99 })
    expect(board.listPlacements('timeline').get('card-1')).toEqual({ x: 10, y: 20 })
    board.setPlacement('timeline', 'card-1', null)
    expect(board.listPlacements('timeline').size).toBe(0)
    expect(board.listPlacements('issueMap').size).toBe(1)
  })

  it('syncs between two documents through Yjs updates', () => {
    const boardA = new DocumentBoard()
    const boardB = new DocumentBoard(new Y.Doc())
    boardA.doc.on('update', (update: Uint8Array) => Y.applyUpdate(boardB.doc, update))
    boardA.appendSegment({
      id: 's1',
      speakerId: 'sp',
      text: 'hello',
      language: 'en',
      sourceId: 'mic',
      startMs: 0,
      endMs: 1000,
      finalizedAt: 1,
    })
    expect(boardB.listSegments().map((segment) => segment.text)).toEqual(['hello'])
  })
})

// Tests for echo suppression between meeting-tab and microphone streams.
import { describe, expect, it } from 'vitest'
import { DocumentBoard, type TranscriptSegment } from '@ekklesiazous/shared'
import { EchoGuard } from './EchoGuard'

function segment(
  id: string,
  sourceId: string,
  text: string,
  finalizedAt: number,
): TranscriptSegment {
  return {
    id,
    speakerId: sourceId,
    text,
    language: 'en',
    sourceId,
    startMs: 0,
    endMs: 1,
    finalizedAt,
  }
}

function createGuard(board: DocumentBoard): { guard: EchoGuard; flush: () => void } {
  const pending: Array<() => void> = []
  const guard = new EchoGuard(
    board,
    () => 10_000,
    (callback) => pending.push(callback),
  )
  return { guard, flush: () => pending.splice(0).forEach((callback) => callback()) }
}

describe('EchoGuard', () => {
  it('passes diarized segments and lone microphones straight through', () => {
    const board = new DocumentBoard()
    const { guard } = createGuard(board)
    const appended: string[] = []
    guard.admit(segment('a', 'meeting', 'hello', 9000), false, (item) => appended.push(item.id))
    guard.admit(segment('b', 'mic', 'hi', 9000), true, (item) => appended.push(item.id))
    expect(appended).toEqual(['a', 'b'])
  })

  it('drops a microphone echo of meeting audio and keeps genuine host speech', () => {
    const board = new DocumentBoard()
    board.appendSegment(segment('t1', 'meeting', 'We should test the existing API first.', 9500))
    const { guard, flush } = createGuard(board)
    const appended: string[] = []
    guard.admit(segment('m1', 'mic', 'we should test the existing API first', 9800), true, (item) =>
      appended.push(item.id),
    )
    guard.admit(segment('m2', 'mic', 'I agree, let me set it up.', 9900), true, (item) =>
      appended.push(item.id),
    )
    expect(appended).toEqual([])
    flush()
    expect(appended).toEqual(['m2'])
  })
})

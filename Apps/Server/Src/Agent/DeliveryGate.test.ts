// Tests for delivery timing (immediate, breakpoint, digest) and minimum holds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentBoard, type Insight, type UxOption } from '@ekklesiazous/shared'
import { DeliveryGate } from './DeliveryGate'
import { InsightHandle } from './InsightHandle'

function createHandle(board: DocumentBoard, id: string, urgency = 0.5): InsightHandle {
  return new InsightHandle(board, { id, urgency, status: 'researching' } as Insight)
}

afterEach(() => vi.useRealTimers())

describe('DeliveryGate', () => {
  it('holds until a breakpoint, or at most six seconds', () => {
    vi.useFakeTimers()
    const board = new DocumentBoard()
    const released: string[] = []
    const gate = new DeliveryGate(
      () => 'breakpoint',
      (handle) => released.push(handle.insight.id),
    )
    gate.submit(createHandle(board, 'a'), { isImmediate: false, minimumHoldMs: 0 })
    expect(released).toEqual([])
    gate.notifyBreakpoint()
    expect(released).toEqual(['a'])
    expect(board.getInsight('a')).toBeDefined()

    gate.submit(createHandle(board, 'b'), { isImmediate: false, minimumHoldMs: 0 })
    vi.advanceTimersByTime(6500)
    expect(released).toEqual(['a', 'b'])
    gate.dispose()
  })

  it('releases urgent and explicit items immediately', () => {
    const board = new DocumentBoard()
    const released: string[] = []
    const gate = new DeliveryGate(
      () => 'digest',
      (handle) => released.push(handle.insight.id),
    )
    gate.submit(createHandle(board, 'urgent', 0.9), { isImmediate: false, minimumHoldMs: 0 })
    gate.submit(createHandle(board, 'asked'), { isImmediate: true, minimumHoldMs: 0 })
    expect(released).toEqual(['urgent', 'asked'])
    gate.dispose()
  })

  it('batches into digests and honours minimum holds', () => {
    vi.useFakeTimers()
    const board = new DocumentBoard()
    const released: string[] = []
    let timing: UxOption<'deliveryTiming'> = 'digest'
    const gate = new DeliveryGate(
      () => timing,
      (handle) => released.push(handle.insight.id),
    )
    gate.submit(createHandle(board, 'a'), { isImmediate: false, minimumHoldMs: 0 })
    gate.notifyBreakpoint()
    expect(released).toEqual([])
    vi.advanceTimersByTime(60_500)
    expect(released).toEqual(['a'])

    timing = 'breakpoint'
    gate.submit(createHandle(board, 'dissent'), { isImmediate: true, minimumHoldMs: 8000 })
    gate.notifyBreakpoint()
    expect(released).toEqual(['a'])
    vi.advanceTimersByTime(8000)
    gate.notifyBreakpoint()
    expect(released).toEqual(['a', 'dissent'])
    gate.dispose()
  })
})

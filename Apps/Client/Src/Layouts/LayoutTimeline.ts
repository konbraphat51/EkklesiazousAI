// Timeline rail: transcript on speaker lanes along a time axis, each insight hung above the moment
// that triggered it (hypothesis: temporal anchoring makes it cheap to connect information to talk).
import {
  CARD_HEIGHT_ESTIMATE,
  CARD_WIDTH,
  applyPlacement,
  placeNotes,
  selectVisibleInsights,
  type CanvasNode,
  type LayoutInput,
  type LayoutResult,
  type LayoutStrategy,
} from './LayoutTypes'

/** Horizontal scale: canvas units per second of meeting time. */
export const TIMELINE_PX_PER_SECOND = 14
const LANE_HEIGHT = 34
const LANE_TOP = 40
const CARD_ROW_BOTTOM = -40
const CARD_GAP = 24
const CARD_ROW_GAP = 60
const SEGMENT_MIN_WIDTH = 28
const SEGMENT_MAX_WIDTH = 900
const SEGMENT_WINDOW = 400

/** Timeline rail layout. */
export class LayoutTimeline implements LayoutStrategy {
  readonly id = 'timeline' as const

  compute(input: LayoutInput): LayoutResult {
    const origin = input.meetingStartedAt ?? input.segments[0]?.finalizedAt ?? input.now
    const toX = (epochMs: number): number => ((epochMs - origin) / 1000) * TIMELINE_PX_PER_SECOND
    const nowX = Math.max(0, toX(input.now))
    const nodes: CanvasNode[] = []

    // speaker lanes in order of first appearance
    const laneOf = new Map<string, number>()
    for (const segment of input.segments) {
      if (!laneOf.has(segment.speakerId)) laneOf.set(segment.speakerId, laneOf.size)
    }
    const laneRight = new Map<string, number>()
    const segments = input.segments.slice(-SEGMENT_WINDOW)
    for (const segment of segments) {
      const lane = laneOf.get(segment.speakerId) ?? 0
      const x = (segment.startMs / 1000) * TIMELINE_PX_PER_SECOND
      const durationWidth = ((segment.endMs - segment.startMs) / 1000) * TIMELINE_PX_PER_SECOND
      const width = Math.min(SEGMENT_MAX_WIDTH, Math.max(SEGMENT_MIN_WIDTH, durationWidth))
      // a bar never starts before the previous bar of the same speaker ends
      const left = Math.max(x, laneRight.get(segment.speakerId) ?? -Infinity)
      laneRight.set(segment.speakerId, left + width + 2)
      nodes.push({
        id: `segment:${segment.id}`,
        type: 'segment',
        x: left,
        y: LANE_TOP + lane * LANE_HEIGHT,
        width,
        data: { segment },
        isDraggable: false,
        zIndex: 1,
      })
    }

    // cards sit in two rows above the rail and drift right instead of piling up;
    // axis markers show the moment each card was triggered
    const rowRight = [-Infinity, -Infinity]
    const anchors: Array<{ x: number; kind: string }> = []
    let lastCardCenter = -Infinity
    for (const insight of selectVisibleInsights(input.insights)) {
      const anchorX = toX(insight.timings.utteranceAt)
      const row = rowRight[0]! <= rowRight[1]! ? 0 : 1
      const x = Math.max(0, anchorX - CARD_WIDTH / 2, rowRight[row]! + CARD_GAP)
      rowRight[row] = x + CARD_WIDTH
      anchors.push({ x: anchorX, kind: insight.kind })
      lastCardCenter = Math.max(lastCardCenter, x + CARD_WIDTH / 2)
      nodes.push(
        applyPlacement(
          {
            id: `insight:${insight.id}`,
            type: 'insight',
            x,
            y: CARD_ROW_BOTTOM - CARD_HEIGHT_ESTIMATE - row * (CARD_HEIGHT_ESTIMATE + CARD_ROW_GAP),
            width: CARD_WIDTH,
            data: { insight, anchorX },
            isDraggable: true,
            zIndex: 2,
          },
          input.placements,
        ),
      )
    }

    nodes.push({
      id: 'timeAxis',
      type: 'timeAxis',
      x: 0,
      y: 0,
      width: Math.max(nowX, lastCardCenter) + 600,
      data: { pxPerSecond: TIMELINE_PX_PER_SECOND, nowX, anchors },
      isDraggable: false,
      zIndex: 0,
    })

    nodes.push(...placeNotes(input.notes, input.placements, -NOTE_COLUMN_OFFSET, LANE_TOP))
    return {
      nodes,
      edges: [],
      // keep the most recent card rows and the speaker lanes in view
      focusPoint: {
        x: Math.max(nowX, lastCardCenter) - 160,
        y: CARD_ROW_BOTTOM - CARD_HEIGHT_ESTIMATE,
      },
      isPeripheral: false,
    }
  }
}

const NOTE_COLUMN_OFFSET = 280

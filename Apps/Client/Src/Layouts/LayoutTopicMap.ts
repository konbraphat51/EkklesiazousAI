// Topic islands: insights clustered in stable, per-topic frames that never move on their own
// (hypothesis: spatial memory and clustering help groups see what has been covered and what is missing).
import type { Insight, Topic } from '@ekklesiazous/shared'
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

const COLUMNS = 3
const CARDS_PER_ROW = 2
const GAP = 20
const HEADER = 56
const PADDING = 20
const ISLAND_GAP = 80
const ISLAND_WIDTH = PADDING * 2 + CARDS_PER_ROW * CARD_WIDTH + (CARDS_PER_ROW - 1) * GAP
const IDLE_MS = 10 * 60_000
const OTHER_TOPIC_ID = '__other__'

/** Topic islands layout. */
export class LayoutTopicMap implements LayoutStrategy {
  readonly id = 'topicMap' as const

  compute(input: LayoutInput): LayoutResult {
    const insights = selectVisibleInsights(input.insights)
    const topics = [...input.topics].sort((a, b) => a.createdAt - b.createdAt)
    const topicIds = new Set(topics.map((topic) => topic.id))
    const byTopic = new Map<string, Insight[]>()
    for (const insight of insights) {
      const key =
        insight.topicId && topicIds.has(insight.topicId) ? insight.topicId : OTHER_TOPIC_ID
      byTopic.set(key, [...(byTopic.get(key) ?? []), insight])
    }
    const islands: Array<{ topic: Topic | null; insights: Insight[] }> = topics.map((topic) => ({
      topic,
      insights: byTopic.get(topic.id) ?? [],
    }))
    const others = byTopic.get(OTHER_TOPIC_ID) ?? []
    if (others.length > 0) islands.push({ topic: null, insights: others })

    const nodes: CanvasNode[] = []
    let rowTop = 0
    let focusPoint: { x: number; y: number } | null = null
    let latestActivity = -Infinity
    // islands keep their slot (index order); a grid row is as tall as its tallest island
    for (let start = 0; start < islands.length; start += COLUMNS) {
      const row = islands.slice(start, start + COLUMNS)
      // topics without cards stay as compact labels
      const heights = row.map((island) =>
        island.insights.length === 0
          ? HEADER + PADDING
          : HEADER +
            PADDING +
            Math.ceil(island.insights.length / CARDS_PER_ROW) * (CARD_HEIGHT_ESTIMATE + GAP),
      )
      row.forEach((island, column) => {
        const x = column * (ISLAND_WIDTH + ISLAND_GAP)
        const frameId = `topic:${island.topic?.id ?? OTHER_TOPIC_ID}`
        const lastActiveAt = island.topic?.lastActiveAt ?? 0
        nodes.push({
          id: frameId,
          type: 'topicFrame',
          x,
          y: rowTop,
          width: ISLAND_WIDTH,
          height: heights[column]!,
          data: {
            label: island.topic?.label ?? null,
            count: island.insights.length,
            isIdle: island.topic !== null && input.now - lastActiveAt > IDLE_MS,
          },
          isDraggable: false,
          zIndex: 0,
        })
        island.insights.forEach((insight, index) => {
          nodes.push(
            applyPlacement(
              {
                id: `insight:${insight.id}`,
                type: 'insight',
                x: x + PADDING + (index % CARDS_PER_ROW) * (CARD_WIDTH + GAP),
                y:
                  rowTop +
                  HEADER +
                  Math.floor(index / CARDS_PER_ROW) * (CARD_HEIGHT_ESTIMATE + GAP),
                width: CARD_WIDTH,
                data: { insight },
                isDraggable: true,
                zIndex: 2,
              },
              input.placements,
            ),
          )
        })
        const newestCardAt = Math.max(-Infinity, ...island.insights.map((item) => item.createdAt))
        if (newestCardAt > latestActivity) {
          latestActivity = newestCardAt
          focusPoint = { x: x + ISLAND_WIDTH / 2, y: rowTop + heights[column]! / 2 }
        }
      })
      rowTop += Math.max(...heights) + ISLAND_GAP
    }

    nodes.push(...placeNotes(input.notes, input.placements, -NOTE_COLUMN_OFFSET, 0))
    return { nodes, edges: [], focusPoint, isPeripheral: false }
  }
}

const NOTE_COLUMN_OFFSET = 300

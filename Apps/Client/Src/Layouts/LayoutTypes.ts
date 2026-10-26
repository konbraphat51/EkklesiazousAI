// Contracts of canvas layout strategies: pure functions from board state to positioned items.
import type {
  Insight,
  IssueNode,
  LayoutId,
  Note,
  Placement,
  Speaker,
  Topic,
  TranscriptSegment,
} from '@ekklesiazous/shared'

/** Kinds of canvas items. */
export type CanvasNodeType = 'insight' | 'segment' | 'topicFrame' | 'issue' | 'note' | 'timeAxis'

/** A positioned canvas item. */
export interface CanvasNode {
  /** Unique id (prefixed by type to avoid collisions). */
  id: string
  /** Item kind (selects the Vue component). */
  type: CanvasNodeType
  /** Left edge in canvas units. */
  x: number
  /** Top edge in canvas units. */
  y: number
  /** Width in canvas units. */
  width: number
  /** Height in canvas units, when fixed. */
  height?: number
  /** Item payload for the component. */
  data: Record<string, unknown>
  /** Whether participants may drag the item. */
  isDraggable: boolean
  /** Stacking order. */
  zIndex?: number
}

/** A connector between two items. */
export interface CanvasEdge {
  /** Unique id. */
  id: string
  /** Source node id. */
  source: string
  /** Target node id. */
  target: string
  /** Stroke color. */
  color: string
  /** Dashed stroke (evidence links). */
  isDashed: boolean
}

/** Everything a layout may use. */
export interface LayoutInput {
  insights: Insight[]
  segments: TranscriptSegment[]
  speakers: Speaker[]
  topics: Topic[]
  issues: IssueNode[]
  notes: Note[]
  /** Manual positions of this layout, keyed by node id. */
  placements: Map<string, Placement>
  /** Meeting start (epoch ms), the time origin. */
  meetingStartedAt: number | null
  /** Current time (epoch ms). */
  now: number
}

/** Output of a layout. */
export interface LayoutResult {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  /** Where "now" is on the canvas (auto-follow target), if meaningful. */
  focusPoint: { x: number; y: number } | null
  /** When true, insights are shown in edge trays instead of on the canvas. */
  isPeripheral: boolean
}

/** A canvas arrangement embodying one presentation hypothesis. */
export interface LayoutStrategy {
  /** Layout id. */
  readonly id: LayoutId
  /**
   * Positions items.
   *
   * @param input - Board state.
   */
  compute(input: LayoutInput): LayoutResult
}

/** Card width in canvas units. */
export const CARD_WIDTH = 320
/** Estimated collapsed card height used for stacking. */
export const CARD_HEIGHT_ESTIMATE = 200
/** Note width in canvas units. */
export const NOTE_WIDTH = 220

/**
 * Lists insights that should appear (not dismissed).
 *
 * @param insights - All insights.
 */
export function selectVisibleInsights(insights: Insight[]): Insight[] {
  return insights
    .filter((insight) => insight.status !== 'dismissed')
    .sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Creates note nodes: manual placement when present, otherwise a column left of the origin.
 *
 * @param notes - Sticky notes.
 * @param placements - Manual placements.
 * @param originX - Left edge of the default column.
 * @param originY - Top of the default column.
 */
export function placeNotes(
  notes: Note[],
  placements: Map<string, Placement>,
  originX: number,
  originY: number,
): CanvasNode[] {
  return [...notes]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((note, index) => ({
      id: `note:${note.id}`,
      type: 'note' as const,
      x: originX,
      y: originY + index * 150,
      width: NOTE_WIDTH,
      data: { note },
      isDraggable: true,
      zIndex: 3,
    }))
    .map((node) => applyPlacement(node, placements))
}

/**
 * Overrides a node position with a participant's manual placement.
 *
 * @param node - Node with its automatic position.
 * @param placements - Manual placements.
 */
export function applyPlacement(node: CanvasNode, placements: Map<string, Placement>): CanvasNode {
  const placement = placements.get(node.id)
  return placement ? { ...node, x: placement.x, y: placement.y } : node
}

// IBIS issue map: questions → ideas → pros/cons/decisions as a left-to-right tree; evidence and
// critique cards show as chips on the node they inform, full cards in a column on the right
// (hypothesis: explicit argument structure counters circular discussion and premature consensus).
import type { Insight, IssueNode } from '@ekklesiazous/shared'
import {
  CARD_HEIGHT_ESTIMATE,
  CARD_WIDTH,
  applyPlacement,
  placeNotes,
  selectVisibleInsights,
  type CanvasEdge,
  type CanvasNode,
  type LayoutInput,
  type LayoutResult,
  type LayoutStrategy,
} from './LayoutTypes'

const NODE_WIDTH = 250
const NODE_HEIGHT = 64
const CHIP_HEIGHT = 24
const LEVEL_GAP = 300
const ROW_HEIGHT = 92
const ROW_GAP = 24
const TREE_GAP = 56
const EVIDENCE_GAP = 80
const CARD_GAP = 20

/** Edge colors per child type (CSS variables resolved by the edge renderer). */
export const ISSUE_COLORS: Record<IssueNode['type'], string> = {
  question: 'var(--issue-question)',
  idea: 'var(--issue-idea)',
  pro: 'var(--issue-pro)',
  con: 'var(--issue-con)',
  decision: 'var(--issue-decision)',
}

/** IBIS issue map layout. */
export class LayoutIssueMap implements LayoutStrategy {
  readonly id = 'issueMap' as const

  compute(input: LayoutInput): LayoutResult {
    const issues = [...input.issues].sort((a, b) => a.createdAt - b.createdAt)
    const ids = new Set(issues.map((node) => node.id))
    const childrenOf = new Map<string, IssueNode[]>()
    for (const node of issues) {
      if (node.parentId && ids.has(node.parentId)) {
        childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node])
      }
    }
    const roots = issues.filter((node) => !node.parentId || !ids.has(node.parentId))

    // cards attached to a node appear as chips under it; full cards live in a column on the right
    const attachments = new Map<string, Insight[]>()
    const visible = selectVisibleInsights(input.insights)
    for (const insight of visible) {
      if (insight.issueNodeId && ids.has(insight.issueNodeId)) {
        attachments.set(insight.issueNodeId, [
          ...(attachments.get(insight.issueNodeId) ?? []),
          insight,
        ])
      }
    }
    const heightOf = (node: IssueNode): number =>
      NODE_HEIGHT + (attachments.get(node.id)?.length ?? 0) * CHIP_HEIGHT

    const nodes: CanvasNode[] = []
    const edges: CanvasEdge[] = []
    const positions = new Map<string, { x: number; y: number }>()
    let cursorY = 0
    let maxDepth = 0
    // tidy tree: leaves take successive rows, parents center on their children
    const place = (node: IssueNode, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth)
      const children = childrenOf.get(node.id) ?? []
      let y: number
      if (children.length === 0) {
        y = cursorY
        cursorY += Math.max(ROW_HEIGHT, heightOf(node) + ROW_GAP)
      } else {
        const childYs = children.map((child) => place(child, depth + 1))
        y = (childYs[0]! + childYs.at(-1)!) / 2
        cursorY = Math.max(cursorY, y + heightOf(node) + ROW_GAP)
      }
      positions.set(node.id, { x: depth * LEVEL_GAP, y })
      return y
    }
    for (const root of roots) {
      place(root, 0)
      cursorY += TREE_GAP
    }

    for (const node of issues) {
      const position = positions.get(node.id)!
      const chips = (attachments.get(node.id) ?? []).map((insight) => ({
        insightId: insight.id,
        kind: insight.kind,
        title: insight.title,
      }))
      nodes.push(
        applyPlacement(
          {
            id: `issue:${node.id}`,
            type: 'issue',
            x: position.x,
            y: position.y,
            width: NODE_WIDTH,
            data: { node, chips },
            isDraggable: true,
            zIndex: 2,
          },
          input.placements,
        ),
      )
      if (node.parentId && ids.has(node.parentId)) {
        edges.push({
          id: `edge:${node.parentId}:${node.id}`,
          source: `issue:${node.parentId}`,
          target: `issue:${node.id}`,
          color: ISSUE_COLORS[node.type],
          isDashed: false,
        })
      }
    }

    const columnX = (maxDepth + 1) * LEVEL_GAP + EVIDENCE_GAP
    visible.reverse().forEach((insight, index) => {
      nodes.push(
        applyPlacement(
          {
            id: `insight:${insight.id}`,
            type: 'insight',
            x: columnX,
            y: index * (CARD_HEIGHT_ESTIMATE + CARD_GAP),
            width: CARD_WIDTH,
            data: { insight },
            isDraggable: true,
            zIndex: 3,
          },
          input.placements,
        ),
      )
    })

    const latest = issues.reduce<IssueNode | null>(
      (best, node) => (!best || node.updatedAt > best.updatedAt ? node : best),
      null,
    )
    const focus = latest ? positions.get(latest.id) : undefined
    nodes.push(...placeNotes(input.notes, input.placements, -NOTE_COLUMN_OFFSET, 0))
    return {
      nodes,
      edges,
      focusPoint: focus ? { x: focus.x + NODE_WIDTH / 2, y: focus.y } : null,
      isPeripheral: false,
    }
  }
}

const NOTE_COLUMN_OFFSET = 300

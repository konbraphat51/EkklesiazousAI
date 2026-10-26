// Calm periphery: the canvas keeps only participants' notes; insights live in edge trays and only
// urgent ones reach the centre (hypothesis: calm, glanceable presentation minimizes interruption).
import { placeNotes, type LayoutInput, type LayoutResult, type LayoutStrategy } from './LayoutTypes'

/** Calm periphery layout. */
export class LayoutPeriphery implements LayoutStrategy {
  readonly id = 'periphery' as const

  compute(input: LayoutInput): LayoutResult {
    return {
      nodes: placeNotes(input.notes, input.placements, 0, 0),
      edges: [],
      focusPoint: null,
      isPeripheral: true,
    }
  }
}

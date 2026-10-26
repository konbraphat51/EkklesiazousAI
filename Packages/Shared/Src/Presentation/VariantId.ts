// Identifiers of the hypothesis-driven presentation variants of the canvas.

/**
 * Presentation variants; each tests a different hypothesis about live information display.
 *
 * - `timeline`: insights anchored to the moment of the utterance that triggered them.
 * - `topicMap`: insights clustered spatially by discussion topic.
 * - `issueMap`: IBIS argument map with evidence and critiques attached to issues.
 * - `spotlight`: one prominent "now" card for joint attention; everything else stays peripheral.
 */
export type VariantId = 'timeline' | 'topicMap' | 'issueMap' | 'spotlight'

/** Every variant, in menu order. */
export const VARIANT_IDS: readonly VariantId[] = ['timeline', 'topicMap', 'issueMap', 'spotlight']

/**
 * Checks whether a value is a known variant identifier.
 *
 * @param value - Value to test.
 */
export function isVariantId(value: unknown): value is VariantId {
  return typeof value === 'string' && (VARIANT_IDS as readonly string[]).includes(value)
}

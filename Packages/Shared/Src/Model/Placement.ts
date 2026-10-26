// Manual position overrides for canvas items, stored per presentation variant.

/** Canvas coordinates chosen by a participant who dragged an item. */
export interface Placement {
  /** Left edge in canvas units. */
  x: number
  /** Top edge in canvas units. */
  y: number
}

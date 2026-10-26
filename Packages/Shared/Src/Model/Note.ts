// Sticky notes that participants add to the canvas by hand.

/** A participant-authored sticky note. */
export interface Note {
  /** Unique identifier. */
  id: string
  /** Note text. */
  text: string
  /** Index into the client's note color palette. */
  colorIndex: number
  /** Display name of the author. */
  authorName: string
  /** Creation time (epoch ms). */
  createdAt: number
  /** Last update time (epoch ms). */
  updatedAt: number
}

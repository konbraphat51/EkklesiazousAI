// Discussion topics that group insights and issue nodes.

/** A theme the discussion has touched on. */
export interface Topic {
  /** Unique identifier. */
  id: string
  /** Short label in the meeting language. */
  label: string
  /** Creation time (epoch ms). */
  createdAt: number
  /** Last time an utterance or insight referred to this topic (epoch ms). */
  lastActiveAt: number
}

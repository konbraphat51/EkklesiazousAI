// IBIS (Issue-Based Information System) nodes that structure the discussion.

/**
 * IBIS element types.
 *
 * - `question`: an issue being discussed.
 * - `idea`: a position / proposed answer to a question.
 * - `pro` / `con`: arguments supporting or objecting to an idea.
 * - `decision`: a conclusion the group reached.
 */
export type IssueNodeType = 'question' | 'idea' | 'pro' | 'con' | 'decision'

/** One element of the issue map. */
export interface IssueNode {
  /** Unique identifier. */
  id: string
  /** IBIS element type. */
  type: IssueNodeType
  /** Statement text in the meeting language. */
  text: string
  /** Parent node (questions may be roots). */
  parentId: string | null
  /** Topic the node belongs to. */
  topicId: string | null
  /** Speakers who voiced this element. */
  speakerIds: string[]
  /** Whether the node was raised by the agent rather than a participant. */
  isRaisedByAgent: boolean
  /** Creation time (epoch ms). */
  createdAt: number
  /** Last update time (epoch ms). */
  updatedAt: number
}

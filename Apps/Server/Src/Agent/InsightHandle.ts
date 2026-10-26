// In-memory insight that is written to the shared board only once its delivery is released.
import type { DocumentBoard, Insight } from '@ekklesiazous/shared'

/** Wraps one insight while research runs, buffering updates until delivery. */
export class InsightHandle {
  private current: Insight
  private isReleasedFlag = false
  /** Receives every state change (used to stream private insights to their requester). */
  onChange: ((insight: Insight) => void) | null = null

  /**
   * @param board - Board to write to after release.
   * @param initial - Initial insight state.
   */
  constructor(
    private readonly board: DocumentBoard,
    initial: Insight,
  ) {
    this.current = initial
  }

  /**
   * Wraps an insight that is already on the board (e.g. after a server restart).
   *
   * @param board - Board holding the insight.
   * @param insight - The insight.
   */
  static adopt(board: DocumentBoard, insight: Insight): InsightHandle {
    const handle = new InsightHandle(board, insight)
    handle.isReleasedFlag = true
    return handle
  }

  /** Current state (board copy wins once released, since participants may pin or vote). */
  get insight(): Insight {
    if (!this.isReleasedFlag) return this.current
    return this.board.getInsight(this.current.id) ?? this.current
  }

  /** Whether participants can see the insight. */
  get isReleased(): boolean {
    return this.isReleasedFlag
  }

  /** Whether participants dismissed the insight (research should stop). */
  get isDismissed(): boolean {
    return this.insight.status === 'dismissed'
  }

  /** Whether the insight should no longer be delivered (dismissed, or failed before release). */
  get isWithdrawn(): boolean {
    return this.isDismissed || (!this.isReleasedFlag && this.insight.status === 'failed')
  }

  /**
   * Updates fields, on the board too when released.
   *
   * @param patch - Fields to overwrite.
   */
  patch(patch: Partial<Insight>): void {
    this.current = { ...this.insight, ...patch, updatedAt: Date.now() }
    if (this.isReleasedFlag) this.board.patchInsight(this.current.id, patch)
    this.onChange?.(this.current)
  }

  /** Publishes the insight to the board. */
  release(): void {
    if (this.isReleasedFlag) return
    this.isReleasedFlag = true
    this.board.upsertInsight(this.current)
  }
}

// Holds proactive insights until a good moment: immediately, at the next conversational breakpoint,
// or in a periodic digest (the `deliveryTiming` UX feature).
import type { UxOption } from '@ekklesiazous/shared'
import type { InsightHandle } from './InsightHandle'

const URGENT_THRESHOLD = 0.85
const BREAKPOINT_MAX_HOLD_MS = 6000
const DIGEST_INTERVAL_MS = 60_000

/** Options of one submission. */
export interface DeliveryOptions {
  /** Release now regardless of timing (explicit requests, urgent items). */
  isImmediate: boolean
  /** Minimum hold, e.g. to decorrelate anonymous dissent from its author's typing. */
  minimumHoldMs: number
}

/** Releases insight handles according to the room's delivery timing. */
export class DeliveryGate {
  private readonly held: Array<{ handle: InsightHandle; heldAt: number; minimumHoldMs: number }> =
    []
  private readonly timer: NodeJS.Timeout
  private lastDigestAt: number

  /**
   * @param readTiming - Reads the room's current delivery timing option.
   * @param onRelease - Called after a handle is released.
   * @param now - Clock (injectable for tests).
   */
  constructor(
    private readonly readTiming: () => UxOption<'deliveryTiming'>,
    private readonly onRelease: (handle: InsightHandle) => void,
    private readonly now: () => number = Date.now,
  ) {
    this.lastDigestAt = now()
    this.timer = setInterval(() => this.tick(), 500)
  }

  /**
   * Submits a handle for delivery.
   *
   * @param handle - The insight.
   * @param options - Delivery options.
   */
  submit(handle: InsightHandle, options: DeliveryOptions): void {
    const isUrgent = handle.insight.urgency >= URGENT_THRESHOLD
    const isNow =
      options.minimumHoldMs === 0 &&
      (options.isImmediate || isUrgent || this.readTiming() === 'immediate')
    if (isNow) {
      this.release(handle)
      return
    }
    this.held.push({ handle, heldAt: this.now(), minimumHoldMs: options.minimumHoldMs })
  }

  /** Signals a conversational breakpoint (pause or speaker change). */
  notifyBreakpoint(): void {
    if (this.readTiming() === 'digest') return
    this.releaseWhere(() => true)
  }

  /** Releases everything still held (e.g. when the agent pauses). */
  flush(): void {
    this.releaseWhere(() => true, true)
  }

  /** Stops the internal timer. */
  dispose(): void {
    clearInterval(this.timer)
  }

  private tick(): void {
    const timing = this.readTiming()
    const now = this.now()
    if (timing === 'immediate') {
      this.releaseWhere(() => true)
    } else if (timing === 'breakpoint') {
      this.releaseWhere((heldAt) => now - heldAt >= BREAKPOINT_MAX_HOLD_MS)
    } else if (now - this.lastDigestAt >= DIGEST_INTERVAL_MS) {
      this.lastDigestAt = now
      this.releaseWhere(() => true)
    }
  }

  private releaseWhere(predicate: (heldAt: number) => boolean, isForced = false): void {
    const now = this.now()
    for (let index = this.held.length - 1; index >= 0; index--) {
      const entry = this.held[index]!
      const isHoldServed = now - entry.heldAt >= entry.minimumHoldMs
      if (entry.handle.isDismissed) {
        this.held.splice(index, 1)
      } else if (isForced || (isHoldServed && predicate(entry.heldAt))) {
        this.held.splice(index, 1)
        this.release(entry.handle)
      }
    }
  }

  private release(handle: InsightHandle): void {
    handle.release()
    this.onRelease(handle)
  }
}

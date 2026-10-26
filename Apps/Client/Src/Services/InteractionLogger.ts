// Batches participant interaction events and sends them to the server's research log.
import type { InteractionEvent, InteractionEventType, UxSettings } from '@ekklesiazous/shared'
import { api } from './ApiClient'

const FLUSH_INTERVAL_MS = 3000

/** Logs interactions of one participant in one room. */
export class InteractionLogger {
  private queue: InteractionEvent[] = []
  private readonly timer: number

  /**
   * @param roomId - Room the events belong to.
   * @param participantId - Pseudonymous participant id.
   * @param readUx - Reads the participant's effective UX settings.
   */
  constructor(
    private readonly roomId: string,
    private readonly participantId: string,
    private readonly readUx: () => UxSettings,
  ) {
    this.timer = window.setInterval(() => void this.flush(), FLUSH_INTERVAL_MS)
  }

  /**
   * Records one event.
   *
   * @param type - Event type.
   * @param targetId - Target item, if any.
   * @param details - Extra details.
   */
  log(
    type: InteractionEventType,
    targetId: string | null = null,
    details: InteractionEvent['details'] = {},
  ): void {
    this.queue.push({
      type,
      participantId: this.participantId,
      targetId,
      ux: this.readUx(),
      details,
      at: Date.now(),
    })
  }

  /** Sends queued events. */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return
    const events = this.queue.splice(0)
    try {
      await api.sendEvents(this.roomId, events)
    } catch {
      // logging must never disturb the meeting; drop on failure
    }
  }

  /** Stops the timer and sends what is left. */
  dispose(): void {
    window.clearInterval(this.timer)
    void this.flush()
  }
}

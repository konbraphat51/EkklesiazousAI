// Append-only JSONL log of pipeline and interaction events per room, for latency analysis and UX studies.
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const FLUSH_INTERVAL_MS = 2000

/** Buffered JSONL writer for one room. */
export class EventLog {
  private buffer: string[] = []
  private readonly timer: NodeJS.Timeout
  private isDirectoryReady = false

  /**
   * @param directory - Directory of log files.
   * @param roomId - Room whose events are logged.
   */
  constructor(
    private readonly directory: string,
    private readonly roomId: string,
  ) {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS)
  }

  /**
   * Records one event.
   *
   * @param source - `agent` for pipeline events, `client` for participant interactions.
   * @param type - Event type.
   * @param details - Event details.
   */
  record(source: 'agent' | 'client', type: string, details: object): void {
    this.buffer.push(JSON.stringify({ at: Date.now(), source, type, ...details }))
  }

  /** Writes buffered events to disk. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const lines = this.buffer.splice(0)
    if (!this.isDirectoryReady) {
      await mkdir(this.directory, { recursive: true })
      this.isDirectoryReady = true
    }
    await appendFile(path.join(this.directory, `${this.roomId}.jsonl`), `${lines.join('\n')}\n`)
  }

  /** Stops the timer and flushes. */
  async dispose(): Promise<void> {
    clearInterval(this.timer)
    await this.flush()
  }
}

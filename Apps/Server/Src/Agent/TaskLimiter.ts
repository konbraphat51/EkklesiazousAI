// Concurrency limiter with priorities, so explicit requests overtake proactive and prefetch work.

interface TaskQueued {
  priority: number
  start: () => void
}

/** Runs at most `capacity` tasks at once; higher priority runs first. */
export class TaskLimiter {
  private running = 0
  private readonly queue: TaskQueued[] = []

  /**
   * @param capacity - Maximum concurrent tasks.
   */
  constructor(private readonly capacity: number) {}

  /** Whether a task would start immediately. */
  get hasFreeSlot(): boolean {
    return this.running < this.capacity
  }

  /**
   * Runs a task when a slot is free.
   *
   * @param task - Work to run.
   * @param priority - Higher runs earlier.
   */
  run<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        this.running += 1
        task()
          .then(resolve, reject)
          .finally(() => {
            this.running -= 1
            this.next()
          })
      }
      if (this.running < this.capacity) start()
      else {
        this.queue.push({ priority, start })
        this.queue.sort((a, b) => b.priority - a.priority)
      }
    })
  }

  private next(): void {
    if (this.running >= this.capacity) return
    this.queue.shift()?.start()
  }
}

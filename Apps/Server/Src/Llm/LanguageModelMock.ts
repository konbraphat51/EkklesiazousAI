// Offline stand-in for language models: answers from a responder and simulates token streaming.
import {
  LanguageModelError,
  type GenerationRequest,
  type LanguageModel,
  type LanguageModelTask,
} from './LanguageModel'

const STREAM_STEPS = 8

/** Produces mock outputs for a task from its hints. */
export interface MockResponder {
  /**
   * Builds an output object (it is validated against the request schema).
   *
   * @param task - Task of the call.
   * @param hints - Structured facts about the call.
   */
  respond(task: LanguageModelTask, hints: Record<string, string>): unknown
}

/** Simulated latency per task, in milliseconds. */
export type MockLatency = Partial<Record<LanguageModelTask, number>>

const LATENCY_DEFAULT: Record<LanguageModelTask, number> = {
  trigger: 350,
  command: 350,
  gist: 700,
  detail: 1400,
  deepPlan: 1200,
  deep: 3500,
  issueMap: 2500,
  clarification: 900,
  recap: 1200,
  dissent: 600,
}

/** A language model that never leaves the machine. */
export class LanguageModelMock implements LanguageModel {
  readonly modelId = 'mock'

  /**
   * @param responder - Supplies outputs.
   * @param latency - Overrides of the simulated latency.
   */
  constructor(
    private readonly responder: MockResponder,
    private readonly latency: MockLatency = {},
  ) {}

  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const parsed = request.schema.safeParse(this.responder.respond(request.task, request.hints))
    if (!parsed.success)
      throw new LanguageModelError('invalid', `mock output invalid for ${request.task}`)
    const totalMs = this.latency[request.task] ?? LATENCY_DEFAULT[request.task]
    // reveal the output progressively, like a streaming model would
    for (let step = 1; step <= STREAM_STEPS; step++) {
      await sleep(totalMs / STREAM_STEPS, request.signal)
      request.onPartial?.(reveal(parsed.data, step / STREAM_STEPS))
    }
    return parsed.data
  }
}

function reveal(value: unknown, fraction: number): unknown {
  if (typeof value === 'string') return value.slice(0, Math.ceil(value.length * fraction))
  if (Array.isArray(value)) {
    return value.slice(0, Math.ceil(value.length * fraction)).map((item) => reveal(item, fraction))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, reveal(item, fraction)]),
    )
  }
  return value
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    })
  })
}

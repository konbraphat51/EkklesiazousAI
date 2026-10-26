// Provider-neutral contract for streaming structured (JSON-schema) generation.
import type { z } from 'zod'

/**
 * A prompt split by stability so providers can cache the stable prefix.
 *
 * Render order is `system` → `contextBlocks` → `instruction`; everything up to and including
 * `contextBlocks[cacheIndex]` must be byte-identical across calls for caching to hit.
 */
export interface PromptLayered {
  /** Static instructions (always cached). */
  system: string
  /** Context, stable blocks first (e.g. finished transcript chunks), volatile blocks last. */
  contextBlocks: string[]
  /** Index of the last stable context block, or -1 when no block is stable. */
  cacheIndex: number
  /** Volatile instruction for this call. */
  instruction: string
}

/** Purpose of a generation call (for logs, latency metrics and the mock model). */
export type LanguageModelTask =
  | 'trigger'
  | 'command'
  | 'gist'
  | 'detail'
  | 'deepPlan'
  | 'deep'
  | 'issueMap'
  | 'clarification'
  | 'recap'
  | 'dissent'

/** One structured generation call. */
export interface GenerationRequest<T> {
  /** Purpose of the call. */
  task: LanguageModelTask
  /** Structured facts about the call (logged, and used by the mock model to answer). */
  hints: Record<string, string>
  /** The prompt. */
  prompt: PromptLayered
  /** Output schema; the result is validated against it. */
  schema: z.ZodType<T>
  /** Output token ceiling. */
  maxTokens: number
  /** Cancels the call. */
  signal?: AbortSignal
  /** Receives best-effort parses of the incomplete JSON while it streams. */
  onPartial?: (partial: unknown) => void
}

/** A language model that streams schema-constrained JSON. */
export interface LanguageModel {
  /** Model identifier, for logs and capability reports. */
  readonly modelId: string
  /**
   * Generates one schema-valid object.
   *
   * @param request - Prompt, schema and streaming callback.
   * @throws LanguageModelError when the model refuses, truncates or returns invalid JSON.
   */
  generate<T>(request: GenerationRequest<T>): Promise<T>
}

/** Failure of a generation call that retrying with the same input will not fix. */
export class LanguageModelError extends Error {
  /**
   * @param reason - Machine-readable failure reason.
   * @param message - Human-readable detail.
   */
  constructor(
    public readonly reason: 'refusal' | 'truncated' | 'invalid',
    message: string,
  ) {
    super(message)
    this.name = 'LanguageModelError'
  }
}

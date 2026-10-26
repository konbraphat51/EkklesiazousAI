// Runs several searches concurrently under a deadline (gather) or takes the first useful one (race).
import type { SearchHit, SearchProvider, SearchQuery } from './SearchProvider'

/** One provider call within a fan-out. */
export interface SearchCall {
  /** Provider to call. */
  provider: SearchProvider
  /** Query to send. */
  query: SearchQuery
}

/** Outcome log of a fan-out, for latency instrumentation. */
export interface SearchCallReport {
  /** Provider name. */
  provider: string
  /** Query text. */
  query: string
  /** Elapsed milliseconds, or null if the call missed the deadline. */
  elapsedMs: number | null
  /** Number of hits, or null on failure. */
  hitCount: number | null
}

/** Result of a fan-out. */
export interface SearchFanOutResult {
  /** Deduplicated hits, interleaved across calls. */
  hits: SearchHit[]
  /** One report per call. */
  reports: SearchCallReport[]
}

/**
 * Runs all calls in parallel and returns whatever arrived before the deadline.
 *
 * @param calls - Provider calls.
 * @param deadlineMs - Maximum wait.
 * @param signal - Cancels everything.
 */
export async function gatherSearches(
  calls: SearchCall[],
  deadlineMs: number,
  signal?: AbortSignal,
): Promise<SearchFanOutResult> {
  const controller = linkAbort(signal)
  const results: Array<SearchHit[] | null> = calls.map(() => null)
  const reports: SearchCallReport[] = calls.map((call) => ({
    provider: call.provider.name,
    query: call.query.text,
    elapsedMs: null,
    hitCount: null,
  }))
  const startedAt = Date.now()
  const runs = calls.map(async (call, index) => {
    try {
      const hits = await call.provider.search(call.query, controller.signal)
      results[index] = hits
      reports[index] = {
        ...reports[index]!,
        elapsedMs: Date.now() - startedAt,
        hitCount: hits.length,
      }
    } catch {
      // calls cut off by the deadline keep a null elapsed time
      if (!controller.signal.aborted) {
        reports[index] = { ...reports[index]!, elapsedMs: Date.now() - startedAt }
      }
    }
  })
  await waitWithDeadline(Promise.all(runs), deadlineMs)
  controller.abort()
  return { hits: interleave(results), reports }
}

/**
 * Returns the hits of the first call that succeeds with at least one hit, aborting the others.
 *
 * @param calls - Provider calls racing each other.
 * @param deadlineMs - Maximum wait.
 * @param signal - Cancels everything.
 */
export async function raceSearches(
  calls: SearchCall[],
  deadlineMs: number,
  signal?: AbortSignal,
): Promise<SearchFanOutResult> {
  const controller = linkAbort(signal)
  const reports: SearchCallReport[] = []
  const startedAt = Date.now()
  const winner = new Promise<SearchHit[]>((resolve) => {
    let pending = calls.length
    if (pending === 0) resolve([])
    for (const call of calls) {
      call.provider
        .search(call.query, controller.signal)
        .then((hits) => {
          reports.push({
            provider: call.provider.name,
            query: call.query.text,
            elapsedMs: Date.now() - startedAt,
            hitCount: hits.length,
          })
          if (hits.length > 0) resolve(hits)
        })
        .catch(() => {
          reports.push({
            provider: call.provider.name,
            query: call.query.text,
            elapsedMs: Date.now() - startedAt,
            hitCount: null,
          })
        })
        .finally(() => {
          pending -= 1
          if (pending === 0) resolve([])
        })
    }
  })
  const hits = (await waitWithDeadline(winner, deadlineMs)) ?? []
  controller.abort()
  return { hits: deduplicate(hits), reports }
}

function linkAbort(signal: AbortSignal | undefined): AbortController {
  const controller = new AbortController()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', () => controller.abort(), { once: true })
  return controller
}

async function waitWithDeadline<T>(promise: Promise<T>, deadlineMs: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), deadlineMs)
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    clearTimeout(timer)
  }
}

// round-robin across calls keeps diversity when the list is truncated later
function interleave(results: Array<SearchHit[] | null>): SearchHit[] {
  const lists = results.filter((list): list is SearchHit[] => list !== null)
  const merged: SearchHit[] = []
  const longest = Math.max(0, ...lists.map((list) => list.length))
  for (let rank = 0; rank < longest; rank++) {
    for (const list of lists) {
      const hit = list[rank]
      if (hit) merged.push(hit)
    }
  }
  return deduplicate(merged)
}

function deduplicate(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>()
  return hits.filter((hit) => {
    const key = hit.url
      .replace(/[#?].*$/, '')
      .replace(/\/$/, '')
      .toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

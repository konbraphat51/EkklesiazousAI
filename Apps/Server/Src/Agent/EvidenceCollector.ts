// Chooses and runs searches for an insight according to its kind and research depth.
import type { InsightKind, ResearchDepth } from '@ekklesiazous/shared'
import { gatherSearches, raceSearches, type SearchCall } from '../Search/SearchFanOut'
import type { SearchHit, SearchMode, SearchProvider } from '../Search/SearchProvider'
import type { AgentSearch } from './AgentToolkit'

const JAPANESE_SCRIPT = /[぀-ヿ㐀-鿿]/

/** What to research. */
export interface EvidenceRequest {
  /** Insight kind. */
  kind: InsightKind
  /** Research depth. */
  depth: ResearchDepth
  /** Primary query. */
  query: string
  /** Same query in the other language, or ''. */
  queryAlternate: string
  /** Term for catch-up cards, or ''. */
  term: string
  /** Extra queries planned for deep research. */
  queriesPlanned: string[]
}

/** Per-depth limits. */
const TIER = {
  quick: { deadlineMs: 1800, maxHits: 4, mode: 'fast' },
  standard: { deadlineMs: 2800, maxHits: 8, mode: 'balanced' },
  deep: { deadlineMs: 9000, maxHits: 14, mode: 'thorough' },
} as const satisfies Record<
  ResearchDepth,
  { deadlineMs: number; maxHits: number; mode: SearchMode }
>

/**
 * Detects the language of a query from its script.
 *
 * @param text - Query text.
 */
export function detectQueryLanguage(text: string): 'en' | 'ja' {
  return JAPANESE_SCRIPT.test(text) ? 'ja' : 'en'
}

/** Builds search plans per tier and runs them with deadlines. */
export class EvidenceCollector {
  /**
   * @param search - Available providers.
   */
  constructor(private readonly search: AgentSearch) {}

  /** Names of all configured providers. */
  get providerNames(): string[] {
    return [
      ...this.search.web,
      ...this.search.papers,
      ...(this.search.encyclopedia ? [this.search.encyclopedia] : []),
    ].map((provider) => provider.name)
  }

  /**
   * Collects evidence.
   *
   * @param request - What to research.
   * @param signal - Cancels searches.
   */
  async collect(request: EvidenceRequest, signal: AbortSignal): Promise<SearchHit[]> {
    const tier = TIER[request.depth]
    const isScholarly = ['priorArt', 'factCheck', 'answer'].includes(request.kind)

    if (request.depth === 'quick') {
      const calls: SearchCall[] = []
      if (request.kind === 'catchUp' && this.search.encyclopedia) {
        const term = request.term || request.query
        calls.push(this.callOf(this.search.encyclopedia, term, 2, tier.mode))
      }
      // the quick tier races web providers and keeps the first useful answer
      const raced = raceSearches(
        this.search.web.map((provider) =>
          this.callOf(provider, request.query, tier.maxHits, tier.mode),
        ),
        tier.deadlineMs,
        signal,
      )
      const [encyclopedia, web] = await Promise.all([
        gatherSearches(calls, tier.deadlineMs, signal),
        raced,
      ])
      return [...encyclopedia.hits, ...web.hits].slice(0, tier.maxHits)
    }

    const queries = [request.query, request.queryAlternate, ...request.queriesPlanned].filter(
      (query) => query.trim().length > 0,
    )
    const calls: SearchCall[] = []
    queries.forEach((query, index) => {
      // spread queries across web providers to diversify results
      const provider = this.search.web[index % Math.max(1, this.search.web.length)]
      if (provider) calls.push(this.callOf(provider, query, 5, tier.mode))
    })
    if (isScholarly) {
      const englishQuery = queries.find((query) => detectQueryLanguage(query) === 'en')
      for (const provider of this.search.papers) {
        if (englishQuery) calls.push(this.callOf(provider, englishQuery, 4, tier.mode))
      }
    }
    if (request.kind === 'catchUp' && this.search.encyclopedia) {
      calls.unshift(
        this.callOf(this.search.encyclopedia, request.term || request.query, 2, tier.mode),
      )
    }
    const result = await gatherSearches(calls, tier.deadlineMs, signal)
    return result.hits.slice(0, tier.maxHits)
  }

  private callOf(
    provider: SearchProvider,
    text: string,
    maxResults: number,
    mode: SearchMode,
  ): SearchCall {
    return { provider, query: { text, language: detectQueryLanguage(text), maxResults, mode } }
  }
}

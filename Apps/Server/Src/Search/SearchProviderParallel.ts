// Parallel Search API: low-latency web search returning LLM-ready excerpts.
import {
  fetchJson,
  getPublisherFromUrl,
  parseYear,
  type SearchHit,
  type SearchMode,
  type SearchProvider,
  type SearchQuery,
} from './SearchProvider'

const PARALLEL_URL = 'https://api.parallel.ai/v1/search'
const MODE_MAP: Record<SearchMode, string> = { fast: 'turbo', balanced: 'fast', thorough: 'basic' }

interface ParallelResponse {
  results?: Array<{ url: string; title?: string; publish_date?: string; excerpts?: string[] }>
}

/** Web search through Parallel. */
export class SearchProviderParallel implements SearchProvider {
  readonly name = 'parallel'
  readonly category = 'web' as const

  /**
   * @param apiKey - Parallel API key.
   */
  constructor(private readonly apiKey: string) {}

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    // Parallel rejects unknown fields, so only documented ones are sent
    const body = {
      search_queries: [query.text],
      objective: query.text,
      mode: MODE_MAP[query.mode],
      advanced_settings: {
        max_results: query.maxResults,
        ...(query.language === 'ja' ? { location: 'jp' } : {}),
        excerpt_settings: { max_chars_per_result: 700 },
      },
    }
    const response = await fetchJson<ParallelResponse>(PARALLEL_URL, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    return (response.results ?? []).slice(0, query.maxResults).map((result) => {
      const passage = (result.excerpts ?? []).join(' … ')
      return {
        title: result.title ?? result.url,
        url: result.url,
        snippet: passage.slice(0, 200),
        publisher: getPublisherFromUrl(result.url),
        year: parseYear(result.publish_date),
        category: 'web',
        passage,
        provider: this.name,
      }
    })
  }
}

// Exa neural web search with query-focused highlights.
import {
  fetchJson,
  getPublisherFromUrl,
  parseYear,
  type SearchHit,
  type SearchMode,
  type SearchProvider,
  type SearchQuery,
} from './SearchProvider'

const EXA_URL = 'https://api.exa.ai/search'
const TYPE_MAP: Record<SearchMode, string> = {
  fast: 'lite',
  balanced: 'auto',
  thorough: 'deep-lite',
}

interface ExaResponse {
  results?: Array<{
    url: string
    title?: string
    publishedDate?: string
    author?: string
    highlights?: string[]
    text?: string
  }>
}

/** Web search through Exa. */
export class SearchProviderExa implements SearchProvider {
  readonly name = 'exa'
  readonly category = 'web' as const

  /**
   * @param apiKey - Exa API key.
   */
  constructor(private readonly apiKey: string) {}

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    const body = {
      query: query.text,
      type: TYPE_MAP[query.mode],
      numResults: query.maxResults,
      ...(query.language === 'ja' ? { userLocation: 'JP' } : {}),
      contents: { highlights: { maxCharacters: 700, query: query.text } },
    }
    const response = await fetchJson<ExaResponse>(EXA_URL, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    return (response.results ?? []).slice(0, query.maxResults).map((result) => {
      const passage = (result.highlights ?? []).join(' … ') || (result.text ?? '').slice(0, 700)
      return {
        title: result.title ?? result.url,
        url: result.url,
        snippet: passage.slice(0, 200),
        publisher: getPublisherFromUrl(result.url),
        year: parseYear(result.publishedDate),
        category: 'web',
        passage,
        provider: this.name,
      }
    })
  }
}

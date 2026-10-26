// OpenAlex works search for scholarly prior art (covers Japanese papers too).
import { fetchJson, type SearchHit, type SearchProvider, type SearchQuery } from './SearchProvider'

const OPENALEX_URL = 'https://api.openalex.org/works'

interface OpenAlexResponse {
  results?: Array<{
    id: string
    display_name?: string
    publication_year?: number
    doi?: string | null
    cited_by_count?: number
    primary_location?: {
      landing_page_url?: string | null
      source?: { display_name?: string } | null
    } | null
    abstract_inverted_index?: Record<string, number[]> | null
  }>
}

/** Credentials and politeness settings for OpenAlex. */
export interface SearchProviderOpenAlexOptions {
  /** Optional API key (raises the daily budget). */
  apiKey: string | null
  /** Optional contact e-mail for the polite pool. */
  email: string | null
}

/** Scholarly search through OpenAlex. */
export class SearchProviderOpenAlex implements SearchProvider {
  readonly name = 'openalex'
  readonly category = 'paper' as const

  /**
   * @param options - Key and contact settings.
   */
  constructor(private readonly options: SearchProviderOpenAlexOptions) {}

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    const parameters = new URLSearchParams({
      search: query.text,
      per_page: String(query.maxResults),
      select:
        'id,display_name,publication_year,doi,cited_by_count,primary_location,abstract_inverted_index',
    })
    if (this.options.apiKey) parameters.set('api_key', this.options.apiKey)
    if (this.options.email) parameters.set('mailto', this.options.email)
    const response = await fetchJson<OpenAlexResponse>(`${OPENALEX_URL}?${parameters.toString()}`, {
      signal,
    })
    return (response.results ?? []).map((work) => {
      const abstract = rebuildAbstract(work.abstract_inverted_index ?? null)
      const venue = work.primary_location?.source?.display_name ?? 'OpenAlex'
      return {
        title: work.display_name ?? 'Untitled',
        url: work.doi ?? work.primary_location?.landing_page_url ?? work.id,
        snippet: `${venue}${work.cited_by_count ? ` · ${work.cited_by_count} citations` : ''}`,
        publisher: venue,
        year: work.publication_year ?? null,
        category: 'paper' as const,
        passage: abstract.slice(0, 900),
        provider: this.name,
      }
    })
  }
}

// OpenAlex ships abstracts as word → positions maps
function rebuildAbstract(index: Record<string, number[]> | null): string {
  if (!index) return ''
  const words: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word
  }
  return words.filter(Boolean).join(' ')
}

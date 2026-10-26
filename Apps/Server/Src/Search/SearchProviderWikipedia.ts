// Wikipedia (ja/en) title lookup plus page summary, used for catch-up explainers. No key needed.
import { fetchJson, type SearchHit, type SearchProvider, type SearchQuery } from './SearchProvider'

const USER_AGENT = 'EkklesiazousAI/0.1 (https://github.com/konbraphat51/EkklesiazousAI)'

interface TitleSearchResponse {
  pages?: Array<{ key: string; title: string; description?: string | null }>
}

interface SummaryResponse {
  title: string
  extract?: string
  description?: string
  content_urls?: { desktop?: { page?: string } }
}

/** Encyclopedia lookups on Wikipedia in the query's language. */
export class SearchProviderWikipedia implements SearchProvider {
  readonly name = 'wikipedia'
  readonly category = 'encyclopedia' as const

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    const host = `https://${query.language}.wikipedia.org`
    const headers = { 'user-agent': USER_AGENT, 'api-user-agent': USER_AGENT }
    // title search ranks better than full-text search for single terms
    const titles = await fetchJson<TitleSearchResponse>(
      `${host}/w/rest.php/v1/search/title?q=${encodeURIComponent(query.text)}&limit=${Math.min(query.maxResults, 2)}`,
      { headers, signal },
    )
    const summaries = await Promise.all(
      (titles.pages ?? []).map((page) =>
        fetchJson<SummaryResponse>(
          `${host}/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`,
          { headers, signal },
        ).catch(() => null),
      ),
    )
    return summaries.flatMap((summary) => {
      if (!summary?.extract) return []
      const url =
        summary.content_urls?.desktop?.page ?? `${host}/wiki/${encodeURIComponent(summary.title)}`
      return [
        {
          title: summary.title,
          url,
          snippet: summary.description ?? summary.extract.slice(0, 160),
          publisher: `${query.language}.wikipedia.org`,
          year: null,
          category: 'encyclopedia' as const,
          passage: summary.extract,
          provider: this.name,
        },
      ]
    })
  }
}

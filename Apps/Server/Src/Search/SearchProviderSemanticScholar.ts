// Semantic Scholar paper search (needs a key in practice; requests are spaced to 1 per second).
import { fetchJson, type SearchHit, type SearchProvider, type SearchQuery } from './SearchProvider'

const SEMANTIC_SCHOLAR_URL = 'https://api.semanticscholar.org/graph/v1/paper/search'
const MIN_INTERVAL_MS = 1050

interface SemanticScholarResponse {
  data?: Array<{
    paperId: string
    title?: string
    year?: number | null
    url?: string
    venue?: string
    abstract?: string | null
    citationCount?: number
    tldr?: { text?: string } | null
  }>
}

/** Scholarly search through Semantic Scholar, rate-limited to its per-key quota. */
export class SearchProviderSemanticScholar implements SearchProvider {
  readonly name = 'semanticScholar'
  readonly category = 'paper' as const
  private nextSlotAt = 0

  /**
   * @param apiKey - Semantic Scholar API key.
   */
  constructor(private readonly apiKey: string) {}

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    // reserve the next free slot so concurrent callers queue up
    const now = Date.now()
    const slotAt = Math.max(now, this.nextSlotAt)
    this.nextSlotAt = slotAt + MIN_INTERVAL_MS
    if (slotAt > now) await delay(slotAt - now, signal)

    // hyphenated terms return nothing, so hyphens become spaces
    const parameters = new URLSearchParams({
      query: query.text.replace(/-/g, ' '),
      limit: String(query.maxResults),
      fields: 'title,year,url,venue,abstract,citationCount,tldr',
    })
    const response = await fetchJson<SemanticScholarResponse>(
      `${SEMANTIC_SCHOLAR_URL}?${parameters.toString()}`,
      { headers: { 'x-api-key': this.apiKey }, signal },
    )
    return (response.data ?? []).map((paper) => ({
      title: paper.title ?? 'Untitled',
      url: paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`,
      snippet: paper.tldr?.text ?? `${paper.venue ?? ''} · ${paper.citationCount ?? 0} citations`,
      publisher: paper.venue || 'Semantic Scholar',
      year: paper.year ?? null,
      category: 'paper' as const,
      passage: (paper.tldr?.text ?? '') + ' ' + (paper.abstract ?? '').slice(0, 800),
      provider: this.name,
    }))
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
    })
  })
}

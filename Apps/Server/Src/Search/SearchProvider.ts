// Provider-neutral contract for web, academic and encyclopedia search.
import type { InsightSource } from '@ekklesiazous/shared'

/** How much latency a search may spend for better results. */
export type SearchMode = 'fast' | 'balanced' | 'thorough'

/** One search request. */
export interface SearchQuery {
  /** Query text. */
  text: string
  /** Language of the query, used for locale-aware providers. */
  language: 'en' | 'ja'
  /** Maximum number of hits wanted. */
  maxResults: number
  /** Latency/quality trade-off. */
  mode: SearchMode
}

/** One search result with a passage for the writer model. */
export interface SearchHit extends InsightSource {
  /** Longer excerpt given to the language model (not shown to users). */
  passage: string
  /** Provider that returned the hit. */
  provider: string
}

/** A search backend. */
export interface SearchProvider {
  /** Provider name for logs and capability reports. */
  readonly name: string
  /** Kind of sources the provider returns. */
  readonly category: InsightSource['category']
  /**
   * Runs one search.
   *
   * @param query - The request.
   * @param signal - Aborts the HTTP call.
   */
  search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]>
}

/**
 * Extracts a publisher name from a URL (`https://www.nature.com/x` → `nature.com`).
 *
 * @param url - Source URL.
 */
export function getPublisherFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Parses a year from a date-like string.
 *
 * @param value - e.g. `2024-05-01` or `2024`.
 */
export function parseYear(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = /(\d{4})/.exec(value ?? '')
  return match ? Number(match[1]) : null
}

/**
 * Fetches JSON and throws on HTTP errors.
 *
 * @param url - Request URL.
 * @param init - Fetch options.
 */
export async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${new URL(url).host} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

// Tests for search fan-out deadlines, interleaving, deduplication and racing.
import { describe, expect, it } from 'vitest'
import { gatherSearches, raceSearches } from './SearchFanOut'
import type { SearchHit, SearchProvider, SearchQuery } from './SearchProvider'

function hit(url: string, provider: string): SearchHit {
  return {
    title: url,
    url,
    snippet: '',
    publisher: '',
    year: null,
    category: 'web',
    passage: '',
    provider,
  }
}

function provider(
  name: string,
  delayMs: number,
  urls: string[],
  isFailing = false,
): SearchProvider {
  return {
    name,
    category: 'web',
    search: (_query, signal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (isFailing) reject(new Error('boom'))
          else resolve(urls.map((url) => hit(url, name)))
        }, delayMs)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      }),
  }
}

const query: SearchQuery = { text: 'q', language: 'en', maxResults: 5, mode: 'fast' }

describe('gatherSearches', () => {
  it('interleaves results, drops duplicates and ignores late or failing calls', async () => {
    const result = await gatherSearches(
      [
        { provider: provider('a', 5, ['https://x.com/1', 'https://x.com/2']), query },
        { provider: provider('b', 10, ['https://x.com/1/', 'https://y.com/1']), query },
        { provider: provider('slow', 500, ['https://slow.com']), query },
        { provider: provider('bad', 5, [], true), query },
      ],
      100,
    )
    expect(result.hits.map((item) => item.url)).toEqual([
      'https://x.com/1',
      'https://x.com/2',
      'https://y.com/1',
    ])
    expect(result.reports.find((report) => report.provider === 'slow')?.elapsedMs).toBeNull()
  })
})

describe('raceSearches', () => {
  it('returns the first non-empty result', async () => {
    const result = await raceSearches(
      [
        { provider: provider('empty', 1, []), query },
        { provider: provider('fast', 10, ['https://fast.com']), query },
        { provider: provider('slow', 200, ['https://slow.com']), query },
      ],
      500,
    )
    expect(result.hits.map((item) => item.provider)).toEqual(['fast'])
  })

  it('returns nothing when every call fails', async () => {
    const result = await raceSearches([{ provider: provider('bad', 1, [], true), query }], 100)
    expect(result.hits).toEqual([])
  })
})

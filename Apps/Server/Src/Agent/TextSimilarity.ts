// Language-agnostic text similarity (character bigrams), good enough to spot duplicate insights in
// Japanese and English without an embedding call.

/**
 * Normalizes text for comparison: NFKC, lower case, no punctuation or whitespace.
 *
 * @param text - Input text.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

/**
 * Computes the Jaccard similarity of the character bigram sets of two texts (0..1).
 *
 * @param left - First text.
 * @param right - Second text.
 */
export function computeSimilarity(left: string, right: string): number {
  const bigramsLeft = toBigrams(normalizeText(left))
  const bigramsRight = toBigrams(normalizeText(right))
  if (bigramsLeft.size === 0 || bigramsRight.size === 0) return 0
  let shared = 0
  for (const bigram of bigramsLeft) if (bigramsRight.has(bigram)) shared += 1
  return shared / (bigramsLeft.size + bigramsRight.size - shared)
}

function toBigrams(text: string): Set<string> {
  const bigrams = new Set<string>()
  if (text.length === 1) bigrams.add(text)
  for (let index = 0; index < text.length - 1; index++) bigrams.add(text.slice(index, index + 2))
  return bigrams
}

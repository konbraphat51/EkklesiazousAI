// Best-effort parsing of JSON that is still being streamed.
import { parse, Allow } from 'partial-json'

/**
 * Parses an incomplete JSON document, returning whatever prefix is already well-formed.
 *
 * @param text - JSON text received so far.
 * @returns The partial value, or undefined when nothing parseable has arrived yet.
 */
export function parseJsonPartial(text: string): unknown {
  if (text.trim().length === 0) return undefined
  try {
    return parse(text, Allow.ALL)
  } catch {
    return undefined
  }
}

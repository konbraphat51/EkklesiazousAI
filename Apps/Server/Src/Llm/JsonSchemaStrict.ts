// Converts zod schemas into the strict JSON-schema subset accepted by OpenAI-compatible providers.
import { z } from 'zod'

const UNSUPPORTED_KEYWORDS = [
  '$schema',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
]

/**
 * Builds a strict JSON schema: every object closed and every property required.
 *
 * @param schema - Zod schema whose fields are all required.
 */
export function toJsonSchemaStrict(schema: z.ZodType): Record<string, unknown> {
  return normalize(z.toJSONSchema(schema)) as Record<string, unknown>
}

function normalize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalize)
  if (node === null || typeof node !== 'object') return node
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.includes(key)) continue
    result[key] = normalize(value)
  }
  if (result.type === 'object' && result.properties && typeof result.properties === 'object') {
    result.additionalProperties = false
    result.required = Object.keys(result.properties)
  }
  return result
}

// Reads and validates server configuration from environment variables (.env).
import path from 'node:path'
import { z } from 'zod'

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : null))

const booleanFlag = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1')

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:8787'),
  DATA_DIRECTORY: z.string().default('./Data'),
  CLIENT_DIST_DIRECTORY: z.string().default('../Client/dist'),
  MOCK_MODE: z.enum(['auto', 'on', 'off']).default('auto'),

  SPEECH_PROVIDER: z.enum(['auto', 'soniox', 'assemblyai', 'none']).default('auto'),
  SONIOX_API_KEY: optionalSecret,
  SONIOX_MODEL: z.string().default('stt-rt-v5'),
  ASSEMBLYAI_API_KEY: optionalSecret,
  ASSEMBLYAI_MODEL: z.string().default('universal-3-6-pro'),

  LLM_PROVIDER: z.enum(['auto', 'openai', 'anthropic']).default('auto'),
  OPENAI_API_KEY: optionalSecret,
  OPENAI_REASONING_WRITER: z.enum(['none', 'minimal', 'low', 'medium', 'high']).default('none'),
  OPENAI_REASONING_DEEP: z.enum(['none', 'minimal', 'low', 'medium', 'high']).default('medium'),
  ANTHROPIC_API_KEY: optionalSecret,
  // empty means the provider's default (OpenAI: gpt-6-luna / gpt-6.1-sol, Anthropic: Haiku / Opus)
  MODEL_WRITER: optionalSecret,
  MODEL_DEEP: optionalSecret,
  ROUTER_PROVIDER: z.enum(['auto', 'writer', 'cerebras', 'groq']).default('auto'),
  ROUTER_HEDGE: booleanFlag,
  CEREBRAS_API_KEY: optionalSecret,
  CEREBRAS_MODEL: z.string().default('gpt-oss-120b'),
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),

  PARALLEL_API_KEY: optionalSecret,
  EXA_API_KEY: optionalSecret,
  SEMANTIC_SCHOLAR_API_KEY: optionalSecret,
  OPENALEX_API_KEY: optionalSecret,
  OPENALEX_EMAIL: optionalSecret,
  IS_ACADEMIC_SEARCH_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  ZOOM_CLIENT_ID: optionalSecret,
  ZOOM_CLIENT_SECRET: optionalSecret,
  ZOOM_WEBHOOK_SECRET_TOKEN: optionalSecret,

  RECALL_API_KEY: optionalSecret,
  RECALL_API_BASE_URL: z.string().default('https://us-east-1.recall.ai/api/v1'),
  MEETING_BOT_NAME: z.string().default('EkklesiazousAI'),
})

/** Validated server configuration. */
export type ConfigServer = z.infer<typeof environmentSchema> & {
  /** Absolute path of the data directory. */
  dataDirectoryAbsolute: string
  /** Absolute path of the built client, served in production. */
  clientDistDirectoryAbsolute: string
  /** Whether mock providers replace every missing external service. */
  isMockForced: boolean
}

/**
 * Parses configuration from an environment map.
 *
 * @param environment - Usually `process.env`.
 * @param argv - Command-line arguments; `--mock` forces mock mode.
 * @param baseDirectory - Directory relative paths are resolved against.
 * @throws ZodError when a variable is malformed.
 */
export function loadConfigServer(
  environment: NodeJS.ProcessEnv,
  argv: readonly string[],
  baseDirectory: string,
): ConfigServer {
  const parsed = environmentSchema.parse(environment)
  return {
    ...parsed,
    dataDirectoryAbsolute: path.resolve(baseDirectory, parsed.DATA_DIRECTORY),
    clientDistDirectoryAbsolute: path.resolve(baseDirectory, parsed.CLIENT_DIST_DIRECTORY),
    isMockForced: parsed.MOCK_MODE === 'on' || argv.includes('--mock'),
  }
}

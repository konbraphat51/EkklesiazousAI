// Dependencies shared by every room's agent: models, search providers and logging.
import type { LanguageModel } from '../Llm/LanguageModel'
import type { SearchProvider } from '../Search/SearchProvider'

/** Minimal structured logger (compatible with pino / Fastify). */
export interface AgentLogger {
  info(details: object, message: string): void
  warn(details: object, message: string): void
  error(details: object, message: string): void
}

/** Language models by role. */
export interface AgentModels {
  /** Fast trigger detector and command interpreter. */
  router: LanguageModel
  /** Fast writer for gists, details, clarifications and dissent. */
  writer: LanguageModel
  /** Deep model for issue mapping, deep-research planning and writing. */
  deep: LanguageModel
}

/** Search providers by category. */
export interface AgentSearch {
  /** Web search providers, fastest first (raced in the quick tier). */
  web: SearchProvider[]
  /** Scholarly search providers. */
  papers: SearchProvider[]
  /** Encyclopedia provider for catch-up explainers. */
  encyclopedia: SearchProvider | null
}

/** Everything a room agent needs from the outside world. */
export interface AgentToolkit {
  /** Language models. */
  models: AgentModels
  /** Search providers. */
  search: AgentSearch
  /** Logger. */
  log: AgentLogger
}

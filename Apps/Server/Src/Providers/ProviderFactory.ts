// Builds models, search providers and the speech recognizer from configuration, falling back to the
// offline demo providers when keys are missing.
import Anthropic from '@anthropic-ai/sdk'
import type { ServerCapabilities } from '@ekklesiazous/shared'
import type { AgentLogger, AgentToolkit } from '../Agent/AgentToolkit'
import type { ConfigServer } from '../Config/ConfigServer'
import { DemoResponder, SearchProviderDemo } from '../Demo/DemoResponder'
import type { LanguageModel } from '../Llm/LanguageModel'
import { LanguageModelAnthropic } from '../Llm/LanguageModelAnthropic'
import { LanguageModelHedged } from '../Llm/LanguageModelHedged'
import { LanguageModelMock } from '../Llm/LanguageModelMock'
import { LanguageModelOpenAi } from '../Llm/LanguageModelOpenAi'
import { LanguageModelOpenAiCompatible } from '../Llm/LanguageModelOpenAiCompatible'
import { SearchProviderExa } from '../Search/SearchProviderExa'
import { SearchProviderOpenAlex } from '../Search/SearchProviderOpenAlex'
import { SearchProviderParallel } from '../Search/SearchProviderParallel'
import { SearchProviderSemanticScholar } from '../Search/SearchProviderSemanticScholar'
import type { SearchProvider } from '../Search/SearchProvider'
import { SearchProviderWikipedia } from '../Search/SearchProviderWikipedia'
import type { SpeechRecognizer } from '../Speech/SpeechRecognizer'
import { SpeechRecognizerAssemblyAi } from '../Speech/SpeechRecognizerAssemblyAi'
import { SpeechRecognizerSoniox } from '../Speech/SpeechRecognizerSoniox'

const HEDGE_DELAY_MS = 450

/** Everything the server needs from external services. */
export interface ProviderSet {
  /** Models, search and logging for agents. */
  toolkit: AgentToolkit
  /** Speech recognizer, or null when none is configured. */
  recognizer: SpeechRecognizer | null
  /** Capability report for clients. */
  capabilities: ServerCapabilities
}

/**
 * Creates providers from configuration.
 *
 * @param config - Server configuration.
 * @param log - Logger.
 * @throws Error when MOCK_MODE is `off` but no language model key is configured.
 */
export function createProviders(config: ConfigServer, log: AgentLogger): ProviderSet {
  const provider = selectLanguageModelProvider(config)
  const isMock = config.isMockForced || (config.MOCK_MODE === 'auto' && provider === null)
  if (!isMock && provider === null) {
    throw new Error('MOCK_MODE=off requires OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }

  const models = isMock
    ? createMockModels()
    : provider === 'openai'
      ? createModelsOpenAi(config)
      : createModelsAnthropic(config)
  const search = isMock
    ? { web: [new SearchProviderDemo()], papers: [], encyclopedia: null }
    : createSearch(config)
  const recognizer = createRecognizer(config)
  if (isMock) log.info({}, 'running with mock language models and demo search (no API keys)')

  return {
    toolkit: { models, search, log },
    recognizer,
    capabilities: {
      recognizer: recognizer?.name ?? 'none',
      modelFast: models.router.modelId,
      modelDeep: models.deep.modelId,
      searchProviders: [
        ...search.web,
        ...search.papers,
        ...(search.encyclopedia ? [search.encyclopedia] : []),
      ].map((provider) => provider.name),
      isMockMode: isMock,
      isZoomRtmsEnabled: Boolean(
        config.ZOOM_CLIENT_ID && config.ZOOM_CLIENT_SECRET && config.ZOOM_WEBHOOK_SECRET_TOKEN,
      ),
      isMeetingBotEnabled: Boolean(config.RECALL_API_KEY),
    },
  }
}

function createMockModels(): AgentToolkit['models'] {
  const model = new LanguageModelMock(new DemoResponder())
  return { router: model, writer: model, deep: model }
}

// OpenAI is the default when its key is present
function selectLanguageModelProvider(config: ConfigServer): 'openai' | 'anthropic' | null {
  if (config.LLM_PROVIDER === 'openai') return config.OPENAI_API_KEY ? 'openai' : null
  if (config.LLM_PROVIDER === 'anthropic') return config.ANTHROPIC_API_KEY ? 'anthropic' : null
  if (config.OPENAI_API_KEY) return 'openai'
  if (config.ANTHROPIC_API_KEY) return 'anthropic'
  return null
}

function createModelsOpenAi(config: ConfigServer): AgentToolkit['models'] {
  const apiKey = config.OPENAI_API_KEY ?? ''
  const writer = new LanguageModelOpenAi({
    apiKey,
    modelId: config.MODEL_WRITER ?? 'gpt-6-luna',
    reasoningEffort: config.OPENAI_REASONING_WRITER,
  })
  const deep = new LanguageModelOpenAi({
    apiKey,
    modelId: config.MODEL_DEEP ?? 'gpt-6.1-sol',
    reasoningEffort: config.OPENAI_REASONING_DEEP,
  })
  return { router: createRouter(config, writer), writer, deep }
}

function createModelsAnthropic(config: ConfigServer): AgentToolkit['models'] {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY ?? undefined })
  const writer = new LanguageModelAnthropic(client, {
    modelId: config.MODEL_WRITER ?? 'claude-haiku-5-5',
    effort: 'low',
    isThinkingWanted: false,
  })
  const deep = new LanguageModelAnthropic(client, {
    modelId: config.MODEL_DEEP ?? 'claude-opus-5-5',
    effort: 'medium',
    isThinkingWanted: true,
  })
  return { router: createRouter(config, writer), writer, deep }
}

// the router is the latency bottleneck: prefer a wafer-scale/LPU host, hedged with the writer model
function createRouter(config: ConfigServer, writer: LanguageModel): LanguageModel {
  const fastHost = selectFastHost(config)
  if (!fastHost) return writer
  return config.ROUTER_HEDGE ? new LanguageModelHedged(fastHost, writer, HEDGE_DELAY_MS) : fastHost
}

function selectFastHost(config: ConfigServer): LanguageModel | null {
  const wantsCerebras = config.ROUTER_PROVIDER === 'cerebras' || config.ROUTER_PROVIDER === 'auto'
  const wantsGroq = config.ROUTER_PROVIDER === 'groq' || config.ROUTER_PROVIDER === 'auto'
  if (wantsCerebras && config.CEREBRAS_API_KEY) {
    return new LanguageModelOpenAiCompatible({
      provider: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: config.CEREBRAS_API_KEY,
      modelId: config.CEREBRAS_MODEL,
      reasoningEffort: 'low',
    })
  }
  if (wantsGroq && config.GROQ_API_KEY) {
    return new LanguageModelOpenAiCompatible({
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: config.GROQ_API_KEY,
      modelId: config.GROQ_MODEL,
      reasoningEffort: 'low',
    })
  }
  return null
}

function createSearch(config: ConfigServer): AgentToolkit['search'] {
  const web: SearchProvider[] = []
  if (config.PARALLEL_API_KEY) web.push(new SearchProviderParallel(config.PARALLEL_API_KEY))
  if (config.EXA_API_KEY) web.push(new SearchProviderExa(config.EXA_API_KEY))
  const papers: SearchProvider[] = []
  if (config.IS_ACADEMIC_SEARCH_ENABLED) {
    papers.push(
      new SearchProviderOpenAlex({ apiKey: config.OPENALEX_API_KEY, email: config.OPENALEX_EMAIL }),
    )
    if (config.SEMANTIC_SCHOLAR_API_KEY) {
      papers.push(new SearchProviderSemanticScholar(config.SEMANTIC_SCHOLAR_API_KEY))
    }
  }
  return { web, papers, encyclopedia: new SearchProviderWikipedia() }
}

function createRecognizer(config: ConfigServer): SpeechRecognizer | null {
  const wantsSoniox = config.SPEECH_PROVIDER === 'soniox' || config.SPEECH_PROVIDER === 'auto'
  const wantsAssemblyAi =
    config.SPEECH_PROVIDER === 'assemblyai' || config.SPEECH_PROVIDER === 'auto'
  if (wantsSoniox && config.SONIOX_API_KEY) {
    return new SpeechRecognizerSoniox({ apiKey: config.SONIOX_API_KEY, model: config.SONIOX_MODEL })
  }
  if (wantsAssemblyAi && config.ASSEMBLYAI_API_KEY) {
    return new SpeechRecognizerAssemblyAi({
      apiKey: config.ASSEMBLYAI_API_KEY,
      model: config.ASSEMBLYAI_MODEL,
    })
  }
  return null
}

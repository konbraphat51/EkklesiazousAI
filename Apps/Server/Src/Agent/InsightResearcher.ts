// Researches and writes the progressive layers of insights (gist → detail → deep), streaming into cards.
import type { DocumentBoard, InsightSource, UxOption } from '@ekklesiazous/shared'
import type { SearchHit } from '../Search/SearchProvider'
import {
  deepPlanSchema,
  deepSchema,
  detailSchema,
  gistSchema,
  type DeepOutput,
  type DetailOutput,
  type GistOutput,
} from './AgentSchemas'
import type { AgentModels } from './AgentToolkit'
import type { EvidenceCollector, EvidenceRequest } from './EvidenceCollector'
import type { InsightHandle } from './InsightHandle'
import type { MeetingContext } from './MeetingContext'
import {
  PROMPT_PLAN_SYSTEM,
  PROMPT_WRITER_SYSTEM,
  buildPromptWriterInstruction,
  renderSources,
  type PromptWriterCard,
} from './Prompts/PromptWriter'

const RECENT_SEGMENTS = 12

/** Search inputs remembered per insight so deeper layers can reuse them. */
interface ResearchMemory {
  request: EvidenceRequest
  hits: SearchHit[]
}

/** Writes the layers of insights. */
export class InsightResearcher {
  private readonly memory = new Map<string, ResearchMemory>()

  /**
   * @param board - Board (for the glossary).
   * @param context - Prompt context builder.
   * @param models - Writer and deep models.
   * @param evidence - Search planner.
   * @param readFraming - Reads the room's critique framing option.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly context: MeetingContext,
    private readonly models: AgentModels,
    private readonly evidence: EvidenceCollector,
    private readonly readFraming: () => UxOption<'critiqueFraming'>,
  ) {}

  /**
   * Researches and writes the gist (or keeps a preset gist and only gathers evidence).
   *
   * @param handle - Insight to fill.
   * @param request - What to search.
   * @param signal - Cancels the work.
   */
  async writeGist(
    handle: InsightHandle,
    request: EvidenceRequest,
    signal: AbortSignal,
  ): Promise<void> {
    const hits = await this.evidence.collect(request, signal)
    this.memory.set(handle.insight.id, { request, hits })
    handle.patch({ sources: hits.slice(0, 4).map(toSource), status: 'writing', progressNote: '' })
    if (handle.insight.gist) {
      handle.patch({ status: 'ready', timings: { ...handle.insight.timings, readyAt: Date.now() } })
      return
    }

    const output = await this.models.writer.generate<GistOutput>({
      task: 'gist',
      hints: { kind: handle.insight.kind, title: handle.insight.title },
      prompt: this.buildPrompt('gist', handle, hits, this.context.renderRecent(RECENT_SEGMENTS)),
      schema: gistSchema,
      maxTokens: 400,
      signal,
      onPartial: (partial) => {
        const gist = readString(partial, 'gist')
        if (!gist || gist.length <= handle.insight.gist.length) return
        const timings = handle.insight.timings
        handle.patch({
          gist,
          timings: { ...timings, firstContentAt: timings.firstContentAt ?? Date.now() },
        })
      },
    })
    const cited = pickSources(hits, output.sourceIndices, 4)
    handle.patch({
      gist: output.gist,
      confidence: clamp(output.confidence),
      verdict: output.verdict === 'none' ? null : output.verdict,
      sources: cited,
      status: 'ready',
      timings: {
        ...handle.insight.timings,
        firstContentAt: handle.insight.timings.firstContentAt ?? Date.now(),
        readyAt: Date.now(),
      },
    })
    if (handle.insight.kind === 'catchUp' && output.term && output.termDefinition) {
      this.board.upsertGlossary({
        term: output.term,
        definition: output.termDefinition,
        language: handle.insight.language,
        insightId: handle.insight.id,
        createdAt: Date.now(),
      })
    }
  }

  /**
   * Writes the detail layer.
   *
   * @param handle - Insight to fill.
   * @param signal - Cancels the work.
   */
  async writeDetail(handle: InsightHandle, signal: AbortSignal): Promise<void> {
    handle.patch({ detailStatus: 'running' })
    try {
      const hits = await this.ensureEvidence(handle, 'standard', signal)
      const output = await this.models.writer.generate<DetailOutput>({
        task: 'detail',
        hints: { kind: handle.insight.kind, title: handle.insight.title },
        prompt: this.buildPrompt(
          'detail',
          handle,
          hits,
          this.context.renderRecent(RECENT_SEGMENTS),
        ),
        schema: detailSchema,
        maxTokens: 1200,
        signal,
        onPartial: (partial) => {
          handle.patch({
            summary: readString(partial, 'summary') ?? handle.insight.summary,
            bullets: readStrings(partial, 'bullets'),
          })
        },
      })
      handle.patch({
        summary: output.summary,
        bullets: output.bullets,
        sources: mergeSources(handle.insight.sources, pickSources(hits, output.sourceIndices, 6)),
        detailStatus: 'ready',
      })
    } catch (error) {
      handle.patch({ detailStatus: 'failed' })
      throw error
    }
  }

  /**
   * Plans and runs deep research, then writes the deep layer with the deep model.
   *
   * @param handle - Insight to fill.
   * @param signal - Cancels the work.
   */
  async writeDeep(handle: InsightHandle, signal: AbortSignal): Promise<void> {
    handle.patch({ deepStatus: 'running', progressNote: 'planning' })
    try {
      const base = this.memory.get(handle.insight.id)?.request ?? requestFromInsight(handle)
      const plan = await this.models.deep.generate({
        task: 'deepPlan',
        hints: { kind: handle.insight.kind, title: handle.insight.title },
        prompt: {
          system: PROMPT_PLAN_SYSTEM,
          contextBlocks: [this.context.renderRecent(RECENT_SEGMENTS)],
          cacheIndex: -1,
          instruction: `Card (${handle.insight.kind}): ${handle.insight.title}\nGist: ${handle.insight.gist}\nOriginal query: ${base.query}`,
        },
        schema: deepPlanSchema,
        maxTokens: 2000,
        signal,
      })
      const queriesPlanned = plan.subQueries.map((query) => query.text).slice(0, 5)
      handle.patch({ progressNote: `searching:${queriesPlanned.length + 1}` })
      const hits = await this.evidence.collect({ ...base, depth: 'deep', queriesPlanned }, signal)
      handle.patch({ progressNote: `reading:${hits.length}` })
      const output = await this.models.deep.generate<DeepOutput>({
        task: 'deep',
        hints: { kind: handle.insight.kind, title: handle.insight.title },
        prompt: this.buildPrompt(
          'deep',
          handle,
          hits,
          this.context.renderRecent(RECENT_SEGMENTS * 2),
        ),
        schema: deepSchema,
        maxTokens: 6000,
        signal,
        onPartial: (partial) => {
          const sections = readSections(partial)
          if (sections.length > 0) handle.patch({ sections, progressNote: 'writing' })
        },
      })
      handle.patch({
        sections: output.sections,
        sources: mergeSources(handle.insight.sources, pickSources(hits, output.sourceIndices, 10)),
        deepStatus: 'ready',
        progressNote: '',
      })
    } catch (error) {
      handle.patch({ deepStatus: 'failed', progressNote: '' })
      throw error
    }
  }

  private async ensureEvidence(
    handle: InsightHandle,
    depth: 'standard',
    signal: AbortSignal,
  ): Promise<SearchHit[]> {
    const remembered = this.memory.get(handle.insight.id)
    // quick-tier evidence is thin; widen it once for the detail layer
    if (remembered && remembered.request.depth !== 'quick') return remembered.hits
    const request = { ...(remembered?.request ?? requestFromInsight(handle)), depth }
    const hits = await this.evidence.collect(request, signal)
    const merged = dedupeHits([...(remembered?.hits ?? []), ...hits])
    this.memory.set(handle.insight.id, { request, hits: merged })
    return merged
  }

  private buildPrompt(
    layer: 'gist' | 'detail' | 'deep',
    handle: InsightHandle,
    hits: SearchHit[],
    recent: string,
  ): {
    system: string
    contextBlocks: string[]
    cacheIndex: number
    instruction: string
  } {
    const insight = handle.insight
    const card: PromptWriterCard = {
      kind: insight.kind,
      title: insight.title,
      reason: insight.reason,
      triggerQuote: insight.triggerQuote,
      language: insight.language === 'ja' ? 'Japanese' : 'English',
      critiqueFraming: this.readFraming(),
      gist: layer === 'gist' ? '' : insight.gist,
    }
    return {
      system: PROMPT_WRITER_SYSTEM,
      contextBlocks: [recent, renderSources(hits)],
      cacheIndex: -1,
      instruction: buildPromptWriterInstruction(layer, card),
    }
  }
}

function requestFromInsight(handle: InsightHandle): EvidenceRequest {
  const insight = handle.insight
  return {
    kind: insight.kind,
    depth: insight.depth,
    query: insight.query || insight.title,
    queryAlternate: '',
    term: '',
    queriesPlanned: [],
  }
}

function toSource(hit: SearchHit): InsightSource {
  return {
    title: hit.title,
    url: hit.url,
    snippet: hit.snippet,
    publisher: hit.publisher,
    year: hit.year,
    category: hit.category,
  }
}

function pickSources(hits: SearchHit[], indices: number[], limit: number): InsightSource[] {
  const picked = indices
    .filter((index) => Number.isInteger(index) && index >= 0 && index < hits.length)
    .map((index) => hits[index]!)
  return dedupeHits(picked.length > 0 ? picked : hits.slice(0, 3))
    .slice(0, limit)
    .map(toSource)
}

function mergeSources(existing: InsightSource[], added: InsightSource[]): InsightSource[] {
  const seen = new Set(existing.map((source) => source.url))
  return [...existing, ...added.filter((source) => !seen.has(source.url))]
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>()
  return hits.filter((hit) => (seen.has(hit.url) ? false : (seen.add(hit.url), true)))
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5))
}

function readString(partial: unknown, key: string): string | null {
  if (partial === null || typeof partial !== 'object') return null
  const value = (partial as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function readStrings(partial: unknown, key: string): string[] {
  if (partial === null || typeof partial !== 'object') return []
  const value = (partial as Record<string, unknown>)[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readSections(partial: unknown): Array<{ heading: string; points: string[] }> {
  if (partial === null || typeof partial !== 'object') return []
  const sections = (partial as Record<string, unknown>).sections
  if (!Array.isArray(sections)) return []
  return sections.flatMap((section: unknown) => {
    const heading = readString(section, 'heading')
    return heading === null ? [] : [{ heading, points: readStrings(section, 'points') }]
  })
}

// End-to-end test of the agent pipeline: the demo meeting replayed through mock models and search.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DocumentBoard, type Clarification, type Insight } from '@ekklesiazous/shared'
import { DemoPlayer } from '../Demo/DemoPlayer'
import { DemoResponder, SearchProviderDemo } from '../Demo/DemoResponder'
import { LanguageModelMock } from '../Llm/LanguageModelMock'
import { AgentRoom } from './AgentRoom'
import { EventLog } from './EventLog'

const rooms: AgentRoom[] = []
afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose()
})

const silentLog = { info: () => undefined, warn: () => undefined, error: () => undefined }

async function createRoom(): Promise<{ board: DocumentBoard; agent: AgentRoom }> {
  const board = new DocumentBoard()
  const fast = {
    trigger: 20,
    command: 20,
    gist: 40,
    detail: 40,
    deepPlan: 20,
    deep: 40,
    issueMap: 40,
    clarification: 40,
    recap: 40,
    dissent: 20,
  }
  const model = new LanguageModelMock(new DemoResponder(), fast)
  const directory = await mkdtemp(path.join(tmpdir(), 'ekklesiazous-'))
  const agent = new AgentRoom(
    board,
    {
      models: { router: model, writer: model, deep: model },
      search: { web: [new SearchProviderDemo()], papers: [], encyclopedia: null },
      log: silentLog,
    },
    new EventLog(directory, 'test'),
    // the demo runs 40x faster than real time, so per-minute caps are lifted
    { rateLimits: { off: 0, low: 99, medium: 99, high: 99 } },
  )
  rooms.push(agent)
  return { board, agent }
}

async function waitFor(condition: () => boolean, timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now()
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

describe('AgentRoom with the demo meeting', () => {
  it('surfaces researched insights, glossary entries and a wake-word answer', async () => {
    const { board, agent } = await createRoom()
    board.patchMeta({
      proactivity: 'high',
      uxSettings: { ...board.readMeta().uxSettings, deliveryTiming: 'immediate' },
    })
    agent.setAgentState('listening')
    await new DemoPlayer(board, 40).play()

    await waitFor(
      () => board.listInsights().filter((insight) => insight.status === 'ready').length >= 9,
    )
    const insights = board.listInsights()
    const byTitle = (title: string): Insight | undefined =>
      insights.find((insight) => insight.title === title)

    const priorArt = byTitle('Existing tools already transcribe meetings live')
    expect(priorArt?.gist).toContain('Otter.ai')
    expect(priorArt?.sources.length).toBeGreaterThan(0)
    expect(priorArt?.timings.releasedAt).not.toBeNull()
    expect(byTitle('Whisperは標準でストリーミング対応か')?.verdict).toBe('disputed')

    const command = byTitle('Prior research on automatic meeting summarization')
    expect(command?.origin).toBe('command')
    expect(command?.requesterName).toBe('Ben')

    expect(board.listGlossary().map((entry) => entry.term)).toContain('hidden profile')
    expect(board.listTopics().length).toBeGreaterThan(0)
  }, 30_000)

  it('builds the issue map and summary when the agent pauses', async () => {
    const { board, agent } = await createRoom()
    agent.setAgentState('listening')
    await new DemoPlayer(board, 40).play()
    agent.setAgentState('paused')
    await waitFor(() => board.listIssues().length >= 10)
    expect(board.readMeta().summary).toContain('既存サービス')
    const decision = board.listIssues().find((node) => node.type === 'decision')
    expect(decision?.parentId).not.toBeNull()
  }, 30_000)

  it('generates detail on demand and answers clarifications privately', async () => {
    const { board, agent } = await createRoom()
    board.patchMeta({ uxSettings: { ...board.readMeta().uxSettings, deliveryTiming: 'immediate' } })
    agent.setAgentState('listening')
    await new DemoPlayer(board, 40).play()
    await waitFor(() => board.listInsights().some((insight) => insight.status === 'ready'))

    const insight = board.listInsights().find((candidate) => candidate.status === 'ready')!
    expect(agent.requestLayer(insight.id, 'detail', false)).toBe(true)
    await waitFor(() => board.getInsight(insight.id)?.detailStatus === 'ready')
    expect(board.getInsight(insight.id)?.timings.detailReadyAt).not.toBeNull()

    const segment = board.listSegments()[3]!
    const snapshots: Clarification[] = []
    const ask = (participantId: string): Promise<Clarification> =>
      agent.askClarification(
        {
          participantId,
          segmentIds: [segment.id],
          selectedText: null,
          mode: 'utterance',
          recapMinutes: 0,
          language: 'ja',
          background: '',
        },
        (snapshot) => snapshots.push(snapshot),
        new AbortController().signal,
      )
    const first = await ask('p1')
    expect(first.status).toBe('ready')
    expect(first.rephrase).toContain('デモ')
    expect(board.readConfusion().get(segment.id)).toBe(1)

    const insightCount = board.listInsights().length
    await ask('p2')
    expect(board.readConfusion().get(segment.id)).toBe(2)
    // two people flagged the same moment: an anonymous catch-up card is promoted after a short hold
    await waitFor(
      () => board.listInsights().some((candidate) => candidate.origin === 'clarification'),
      8000,
    )
    expect(board.listInsights().length).toBe(insightCount + 1)
  }, 40_000)
})

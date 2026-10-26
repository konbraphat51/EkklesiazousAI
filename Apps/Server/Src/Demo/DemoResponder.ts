// Mock-model responder backed by the demo script, with generic fallbacks for unscripted input.
import type { LanguageModelTask } from '../Llm/LanguageModel'
import type { MockResponder } from '../Llm/LanguageModelMock'
import type { SearchHit, SearchProvider, SearchQuery } from '../Search/SearchProvider'
import {
  DEMO_INSIGHT_LINKS,
  DEMO_ISSUE_NODES,
  DEMO_LINES,
  type DemoInsightContent,
} from './DemoScript'

const DEMO_TOPIC_LABELS = ['文字起こし基盤', 'コストと根拠', '研究と倫理', '進め方']
const JAPANESE = /[぀-ヿ㐀-鿿]/

/** Answers mock model calls from the demo script. */
export class DemoResponder implements MockResponder {
  respond(task: LanguageModelTask, hints: Record<string, string>): unknown {
    switch (task) {
      case 'trigger':
        return this.respondTrigger(hints)
      case 'command':
        return this.respondCommand(hints.text ?? '')
      case 'gist':
      case 'detail':
      case 'deep':
        return this.respondLayer(task, hints.title ?? '')
      case 'deepPlan':
        return {
          subQueries: [
            { text: `${hints.title ?? ''} overview`, language: 'en' },
            { text: `${hints.title ?? ''} limitations`, language: 'en' },
            { text: `${hints.title ?? ''} 事例`, language: 'ja' },
          ],
        }
      case 'issueMap':
        return this.respondIssueMap(Number(hints.segmentCount ?? '0'), hints.insights ?? '[]')
      case 'clarification':
      case 'recap':
        return this.respondClarification(task, hints)
      case 'dissent':
        return this.respondDissent(hints.text ?? '')
    }
  }

  private respondTrigger(hints: Record<string, string>): unknown {
    const texts = (hints.segmentTexts ?? '').split('\n')
    const ids = (hints.segmentIds ?? '').split('\n')
    const proposals = texts.flatMap((text, index) => {
      const lineIndex = DEMO_LINES.findIndex((line) => line.text === text)
      const line = DEMO_LINES[lineIndex]
      if (!line) return []
      return line.insights
        .filter((insight) => insight.proposal.pattern !== 'explicitRequest')
        .map((insight) => ({ ...insight.proposal, segmentIds: ids[index] ? [ids[index]] : [] }))
    })
    const lastIndex = DEMO_LINES.findIndex((line) => line.text === texts.at(-1))
    const topicIndex =
      lastIndex < 0 ? 0 : lastIndex < 8 ? 0 : lastIndex < 10 ? 1 : lastIndex < 12 ? 2 : 3
    return {
      topic: { existingTopicId: '', label: DEMO_TOPIC_LABELS[topicIndex] },
      proposals,
    }
  }

  private respondCommand(text: string): unknown {
    const scripted = DEMO_LINES.flatMap((line) => line.insights).find(
      (insight) =>
        insight.proposal.pattern === 'explicitRequest' &&
        text.toLowerCase().includes('summarization'),
    )
    if (scripted) {
      return { isResearchRequest: true, proposal: { ...scripted.proposal, segmentIds: [] } }
    }
    const isJapanese = JAPANESE.test(text)
    return {
      isResearchRequest: text.trim().length > 0,
      proposal: {
        kind: 'answer',
        pattern: 'explicitRequest',
        title: text.slice(0, 40),
        query: text,
        queryAlternate: '',
        term: '',
        urgency: 0.9,
        reason: isJapanese ? '参加者からの依頼' : 'Requested by a participant',
        segmentIds: [],
        depth: 'default',
      },
    }
  }

  private respondLayer(task: 'gist' | 'detail' | 'deep', title: string): unknown {
    const content = findContent(title)
    const isJapanese = JAPANESE.test(title)
    const fallback = isJapanese
      ? `（デモモード）APIキーを設定すると「${title}」を実際に調査します。`
      : `(Demo mode) Add API keys to research “${title}” for real.`
    if (task === 'gist') {
      return {
        gist: content?.gist ?? fallback,
        confidence: content?.confidence ?? 0.3,
        verdict: content?.verdict ?? 'none',
        sourceIndices: content ? content.sources.map((_, index) => index) : [],
        term: content?.proposal.term ?? '',
        termDefinition: content?.termDefinition ?? '',
      }
    }
    if (task === 'detail') {
      return {
        summary: content?.summary ?? fallback,
        bullets: content?.bullets ?? [],
        sourceIndices: content ? content.sources.map((_, index) => index) : [],
      }
    }
    const note = isJapanese
      ? 'デモモードの深掘りです。APIキーを設定すると実際の深掘り調査を行います。'
      : 'This is a demo deep dive; add API keys for live deep research.'
    return {
      sections: [
        { heading: isJapanese ? '概要' : 'Overview', points: [content?.summary ?? fallback] },
        { heading: isJapanese ? '要点' : 'Key points', points: content?.bullets ?? [] },
        { heading: isJapanese ? '注記' : 'Note', points: [note] },
      ],
      sourceIndices: content ? content.sources.map((_, index) => index) : [],
    }
  }

  private respondIssueMap(segmentCount: number, insightsJson: string): unknown {
    const nodes = DEMO_ISSUE_NODES.filter((node) => node.appearsAfter < segmentCount)
    const summaries = [
      '研究室の会議を自動記録するツールの作り方を議論中。自作案が出ている。',
      '自作かWhisper採用かを議論。Whisperの即時採用に全員が同意したが、ストリーミング対応は未確認。',
      'Whisper採用に合意後、コストと「隠れたプロファイル」問題、既存研究が話題に。録音の同意要否が未解決。',
      '既存サービスを試し、不足部分だけ自作する方針に決定。2週間の試験で日本語精度を測る。',
    ]
    const stage = segmentCount < 5 ? 0 : segmentCount < 9 ? 1 : segmentCount < 13 ? 2 : 3
    return {
      summary: summaries[stage],
      topics: [{ id: 't1', label: '会議記録ツール' }],
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        text: node.text,
        parentId: nodes.some((other) => other.id === node.parentId) ? node.parentId : '',
        topicId: 't1',
        speakerIds: node.speakers.map((speaker) => `demo:${speaker}`),
      })),
      insightLinks: (JSON.parse(insightsJson) as Array<{ id: string; title: string }>).flatMap(
        (insight) => {
          const nodeId = DEMO_INSIGHT_LINKS[insight.title]
          return nodeId && nodes.some((node) => node.id === nodeId)
            ? [{ insightId: insight.id, nodeId }]
            : []
        },
      ),
      critiqueTargets: [],
    }
  }

  private respondClarification(
    task: 'clarification' | 'recap',
    hints: Record<string, string>,
  ): unknown {
    const isJapanese = hints.language === 'ja'
    const quote = (hints.quote ?? '').slice(0, 120)
    if (task === 'recap') {
      return {
        rephrase: isJapanese
          ? '（デモ）この数分間は、会議記録ツールを自作するか既存サービスを使うか、Whisperの性能、費用、録音の同意について話していました。'
          : '(Demo) The last few minutes covered building vs. buying a meeting transcription tool, Whisper’s limits, cost, and recording consent.',
        terms: [
          {
            term: 'Whisper',
            explanation: isJapanese
              ? 'OpenAIの音声認識モデル'
              : 'OpenAI’s speech recognition model',
          },
        ],
        background: isJapanese
          ? '現在は既存APIを試す方向でまとまりつつあります。'
          : 'The group is converging on trialling an existing API.',
        sourceIndices: [],
      }
    }
    const selected = hints.selectedText ?? ''
    return {
      rephrase: isJapanese ? `（デモ）発言の要旨: ${quote}` : `(Demo) In plain words: ${quote}`,
      terms: selected
        ? [
            {
              term: selected,
              explanation: isJapanese
                ? '（デモ）APIキーを設定すると実際の解説が表示されます。'
                : '(Demo) Add API keys for a real explanation.',
            },
          ]
        : [],
      background: isJapanese
        ? '（デモ）議論の文脈: 会議記録ツールの実現方法を検討しています。'
        : '(Demo) Context: the group is deciding how to build a meeting transcription tool.',
      sourceIndices: [],
    }
  }

  private respondDissent(text: string): unknown {
    const isJapanese = JAPANESE.test(text)
    return {
      isAppropriate: text.trim().length > 0,
      title: isJapanese ? '見落としていないか確認したい点' : 'A point worth checking',
      gist: isJapanese
        ? `この点は検討しましたか: ${text.slice(0, 60)}`
        : `Have we considered this: ${text.slice(0, 100)}?`,
      query: text.slice(0, 80),
    }
  }
}

/** Search provider returning the demo script's sources for its queries. */
export class SearchProviderDemo implements SearchProvider {
  readonly name = 'demo'
  readonly category = 'web' as const

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (signal.aborted) return []
    const content = DEMO_LINES.flatMap((line) => line.insights).find(
      (insight) =>
        insight.proposal.query === query.text ||
        insight.proposal.queryAlternate === query.text ||
        insight.proposal.term === query.text,
    )
    return (content?.sources ?? []).slice(0, query.maxResults).map((source) => ({
      ...source,
      passage: source.snippet,
      provider: this.name,
    }))
  }
}

function findContent(title: string): DemoInsightContent | undefined {
  return DEMO_LINES.flatMap((line) => line.insights).find(
    (insight) => insight.proposal.title === title,
  )
}

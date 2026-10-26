// Scripted bilingual (JA/EN) meeting with annotated agent behavior, used by demo mode and mock models.
import type { InsightSource, IssueNodeType } from '@ekklesiazous/shared'
import type { Proposal } from '../Agent/AgentSchemas'

/** Authored content of one demo insight. */
export interface DemoInsightContent {
  /** Proposal the mock router returns. */
  proposal: Omit<Proposal, 'segmentIds'>
  /** One-line gist. */
  gist: string
  /** Confidence 0..1. */
  confidence: number
  /** Fact-check verdict or 'none'. */
  verdict: 'supported' | 'disputed' | 'unclear' | 'none'
  /** Glossary definition for catch-up cards, or ''. */
  termDefinition: string
  /** Detail summary. */
  summary: string
  /** Detail bullets. */
  bullets: string[]
  /** Sources returned by the mock search. */
  sources: InsightSource[]
}

/** One scripted utterance. */
export interface DemoLine {
  /** Speaker key. */
  speaker: 'A' | 'B' | 'C'
  /** Spoken language. */
  language: 'ja' | 'en'
  /** What is said. */
  text: string
  /** Insights the mock router proposes after this line. */
  insights: DemoInsightContent[]
}

/** One node of the scripted issue map, appearing once a given line has been spoken. */
export interface DemoIssueNode {
  /** Stable id. */
  id: string
  /** IBIS type. */
  type: IssueNodeType
  /** Text. */
  text: string
  /** Parent id or ''. */
  parentId: string
  /** Index of the line after which the node exists. */
  appearsAfter: number
  /** Speaker keys who voiced it. */
  speakers: Array<'A' | 'B' | 'C'>
}

/** Display names of the demo speakers. */
export const DEMO_SPEAKERS = { A: 'Aiko', B: 'Ben', C: 'Chen' } as const

function source(
  title: string,
  url: string,
  publisher: string,
  year: number | null,
  category: InsightSource['category'],
  snippet = '',
): InsightSource {
  return { title, url, publisher, year, category, snippet }
}

const SOURCE_WHISPER = source(
  'openai/whisper',
  'https://github.com/openai/whisper',
  'github.com',
  2022,
  'web',
  'Robust speech recognition via large-scale weak supervision',
)
const SOURCE_WHISPER_STREAMING = source(
  'Turning Whisper into Real-Time Transcription System',
  'https://arxiv.org/abs/2307.14743',
  'arXiv',
  2023,
  'paper',
  'whisper_streaming: LocalAgreement policy, ~3.3 s latency',
)
const SOURCE_PYANNOTE = source(
  'pyannote.audio',
  'https://github.com/pyannote/pyannote-audio',
  'github.com',
  null,
  'web',
  'Neural building blocks for speaker diarization',
)

/** The scripted meeting. */
export const DEMO_LINES: readonly DemoLine[] = [
  {
    speaker: 'A',
    language: 'ja',
    text: 'じゃあ始めましょう。今日は研究室のミーティングを自動で記録するツールを作る件です。',
    insights: [],
  },
  {
    speaker: 'B',
    language: 'en',
    text: 'Right. My idea is to build our own transcription pipeline from scratch, so we fully control it.',
    insights: [
      {
        proposal: {
          kind: 'priorArt',
          pattern: 'newIdea',
          title: 'Existing tools already transcribe meetings live',
          query: 'real-time meeting transcription assistant speaker labels',
          queryAlternate: 'リアルタイム 会議 文字起こし 話者分離 サービス',
          term: '',
          urgency: 0.88,
          reason: 'Building from scratch may duplicate mature tools',
          depth: 'default',
        },
        gist: 'Otter.ai, Zoom AI Companion and Teams Copilot already give live transcripts with speaker labels; open-source WhisperX covers offline use.',
        confidence: 0.8,
        verdict: 'none',
        termDefinition: '',
        summary:
          'Commercial meeting assistants already provide real-time transcription, speaker attribution and summaries. Open-source stacks such as WhisperX (Whisper plus pyannote diarization) cover offline processing. Less covered: live bilingual Japanese–English meetings and lab-specific workflows.',
        bullets: [
          'Otter.ai: live transcripts and summaries for Zoom, Meet and Teams',
          'Zoom AI Companion / Teams Copilot: built-in live transcription and recaps',
          'WhisperX: open-source Whisper + pyannote, word timestamps and speakers (offline)',
          'Possible gap: real-time accuracy on Japanese–English code-switching',
        ],
        sources: [
          source(
            'Otter.ai — AI Meeting Notes',
            'https://otter.ai',
            'otter.ai',
            null,
            'web',
            'Live transcription and AI meeting notes',
          ),
          source(
            'Zoom AI Companion',
            'https://www.zoom.com/en/products/ai-assistant/',
            'zoom.com',
            null,
            'web',
            'Meeting summaries and live assistance',
          ),
          source(
            'WhisperX',
            'https://github.com/m-bain/whisperX',
            'github.com',
            2023,
            'web',
            'Word-level timestamps and speaker diarization',
          ),
          SOURCE_PYANNOTE,
        ],
      },
    ],
  },
  {
    speaker: 'C',
    language: 'ja',
    text: '話者の区別もしたいので、ダイアライゼーションも自前で実装しますか？',
    insights: [
      {
        proposal: {
          kind: 'catchUp',
          pattern: 'unfamiliarTerm',
          title: '用語: 話者ダイアライゼーション',
          query: 'speaker diarization',
          queryAlternate: '話者ダイアライゼーション',
          term: 'ダイアライゼーション',
          urgency: 0.6,
          reason: '専門用語を全員が知っているとは限らない',
          depth: 'default',
        },
        gist: '録音の中で「誰がいつ話したか」を自動で区別し、話者ごとにラベル付けする技術です。',
        confidence: 0.9,
        verdict: 'none',
        termDefinition: '音声を話者ごとに区切りラベル付けする技術',
        summary:
          '1本のマイクに複数人の声が入る対面会議では欠かせない処理です。pyannote.audio などのオープンソース実装のほか、リアルタイム音声認識APIの多くが話者分離に対応しています。',
        bullets: [
          '出力は「話者1: 0:00–0:12」のような区間ラベル',
          '声の重なりや短い相槌で誤りやすい',
          'リアルタイム処理はオフライン処理より精度が下がりやすい',
        ],
        sources: [
          source(
            'Speaker diarisation',
            'https://en.wikipedia.org/wiki/Speaker_diarisation',
            'en.wikipedia.org',
            null,
            'encyclopedia',
            'Partitioning audio into segments by speaker identity',
          ),
          SOURCE_PYANNOTE,
        ],
      },
    ],
  },
  {
    speaker: 'A',
    language: 'ja',
    text: 'Whisperってリアルタイムのストリーミングにそのまま対応してるんですよね？',
    insights: [
      {
        proposal: {
          kind: 'factCheck',
          pattern: 'claim',
          title: 'Whisperは標準でストリーミング対応か',
          query: 'Whisper real-time streaming support',
          queryAlternate: 'Whisper リアルタイム ストリーミング',
          term: '',
          urgency: 0.72,
          reason: '採用判断の前提になる主張',
          depth: 'default',
        },
        gist: 'Whisperは30秒単位の一括処理向けの設計で、標準ではストリーミング非対応です。whisper_streaming などの追加実装が必要です。',
        confidence: 0.8,
        verdict: 'disputed',
        termDefinition: '',
        summary:
          'OpenAIのWhisperは30秒の音声窓を単位に推論する設計で、公式実装にストリーミングAPIはありません。逐次認識には whisper_streaming などのラッパーが使われ、論文では約3.3秒の遅延が報告されています。',
        bullets: [
          '公式実装: 30秒窓の一括推論',
          'whisper_streaming: 約3.3秒の遅延での逐次認識を報告',
          '話者の区別はWhisper単体ではできない',
        ],
        sources: [SOURCE_WHISPER, SOURCE_WHISPER_STREAMING],
      },
    ],
  },
  {
    speaker: 'B',
    language: 'en',
    text: "Yeah, I think so. Let's just go with Whisper then. Everyone agrees?",
    insights: [],
  },
  { speaker: 'C', language: 'en', text: 'Sure, sounds good.', insights: [] },
  {
    speaker: 'A',
    language: 'ja',
    text: 'いいと思います。',
    insights: [
      {
        proposal: {
          kind: 'critique',
          pattern: 'quickAgreement',
          title: '全員一致の前に確認したい点',
          query: 'Whisper code-switching overlapping speech accuracy',
          queryAlternate: 'Whisper 日英混在 重なり発話 精度',
          term: '',
          urgency: 0.7,
          reason: '代替案や評価なしに合意が成立した',
          depth: 'default',
        },
        gist: '声の重なりや日英が混ざる発言でも、Whisperで実用的な精度と遅延になるか確かめましたか？',
        confidence: 0.7,
        verdict: 'none',
        termDefinition: '',
        summary:
          'Whisper の採用が、代替案や評価基準の議論なしに数秒で合意されました。会議用途では、話者の重なり・日英の切り替え・リアルタイム遅延が成否を分けます。',
        bullets: [
          '自分たちの会議録音で日英混在の精度を測る',
          '数秒の遅延が議論支援に許容できるか確認する',
          '商用リアルタイムAPIとも比較する',
        ],
        sources: [SOURCE_WHISPER_STREAMING, SOURCE_WHISPER],
      },
    ],
  },
  {
    speaker: 'B',
    language: 'en',
    text: 'Also, I read that brainstorming in a group always produces more ideas than people working alone.',
    insights: [
      {
        proposal: {
          kind: 'factCheck',
          pattern: 'claim',
          title: 'Do brainstorming groups produce more ideas?',
          query: 'nominal groups vs interacting groups brainstorming productivity',
          queryAlternate: 'ブレインストーミング 集団 個人 アイデア数',
          term: '',
          urgency: 0.75,
          reason: 'A common belief contradicted by research',
          depth: 'default',
        },
        gist: 'Meta-analyses find the opposite: people who brainstorm alone and then pool ideas produce more than interacting groups.',
        confidence: 0.85,
        verdict: 'disputed',
        termDefinition: '',
        summary:
          'Diehl & Stroebe (1987) traced the productivity loss mainly to production blocking: only one person can speak at a time. Mullen, Johnson & Salas (1991) confirmed the loss across studies, larger in bigger groups.',
        bullets: [
          '"Nominal groups" (alone, then pooled) beat interacting groups in idea count',
          'Main cause: production blocking while waiting to speak',
          'Writing or electronic brainstorming reduces the loss',
        ],
        sources: [
          source(
            'Productivity loss in brainstorming groups: Toward the solution of a riddle',
            'https://doi.org/10.1037/0022-3514.53.3.497',
            'Journal of Personality and Social Psychology',
            1987,
            'paper',
            'Diehl & Stroebe',
          ),
          source(
            'Productivity loss in brainstorming groups: A meta-analytic integration',
            'https://doi.org/10.1207/s15324834basp1201_1',
            'Basic and Applied Social Psychology',
            1991,
            'paper',
            'Mullen, Johnson & Salas',
          ),
        ],
      },
    ],
  },
  {
    speaker: 'C',
    language: 'ja',
    text: 'コストってどのくらいかかるんでしょう？1時間あたりの料金とか。後で調べましょうか。',
    insights: [
      {
        proposal: {
          kind: 'answer',
          pattern: 'deferredQuestion',
          title: 'リアルタイム音声認識の1時間あたり費用',
          query: 'real-time speech to text API pricing per hour',
          queryAlternate: 'リアルタイム 音声認識 API 料金 1時間',
          term: '',
          urgency: 0.65,
          reason: '後回しにされた質問',
          depth: 'default',
        },
        gist: '主要なリアルタイム音声認識APIは1時間あたり約0.1〜0.6ドル程度です（デモ用の参考値）。',
        confidence: 0.6,
        verdict: 'none',
        termDefinition: '',
        summary:
          '2026年10月の調査メモでは、Soniox が約$0.12/時（話者分離・言語判定込み）、AssemblyAI のリアルタイムモデルが約$0.45/時に話者ラベル約$0.12/時が加算と記録されています。最新の料金は公式ページで確認してください。',
        bullets: [
          'Soniox: 約$0.12/時',
          'AssemblyAI Universal Streaming: 約$0.45/時＋話者ラベル',
          '接続時間課金のため無音時間も費用に含まれる',
        ],
        sources: [
          source('Soniox Pricing', 'https://soniox.com/pricing', 'soniox.com', 2026, 'web'),
          source(
            'AssemblyAI Pricing',
            'https://www.assemblyai.com/pricing',
            'assemblyai.com',
            2026,
            'web',
          ),
        ],
      },
    ],
  },
  {
    speaker: 'A',
    language: 'ja',
    text: 'あと、情報が共有されないまま議論が進む問題、なんて言うんでしたっけ、hidden profile？',
    insights: [
      {
        proposal: {
          kind: 'catchUp',
          pattern: 'unfamiliarTerm',
          title: '用語: 隠れたプロファイル課題',
          query: 'hidden profile paradigm group decision making',
          queryAlternate: '隠れたプロファイル 集団意思決定',
          term: 'hidden profile',
          urgency: 0.62,
          reason: '参照された研究概念の補足',
          depth: 'default',
        },
        gist: '各自だけが持つ情報が議論で共有されず、全員が知る情報ばかりが話される現象を調べる実験課題です。',
        confidence: 0.9,
        verdict: 'none',
        termDefinition: '個人だけが持つ情報が集団議論で共有されにくい現象の実験パラダイム',
        summary:
          'Stasser & Titus (1985) が提唱しました。正解には各自の非共有情報を合わせる必要がありますが、集団は共有情報を中心に議論し、誤った結論に至りやすいことが示されています。',
        bullets: [
          'メタ分析でも、非共有情報の共有は少なく正答率は低い (Lu ら 2012)',
          '先に意見を表明すると情報共有がさらに減る',
          '対策: 評価の前に情報を出し切る',
        ],
        sources: [
          source(
            'Pooling of unshared information in group decision making',
            'https://doi.org/10.1037/0022-3514.48.6.1467',
            'Journal of Personality and Social Psychology',
            1985,
            'paper',
            'Stasser & Titus',
          ),
          source(
            'Twenty-five years of hidden profiles in group decision making: A meta-analysis',
            'https://doi.org/10.1177/1088868311417243',
            'Personality and Social Psychology Review',
            2012,
            'paper',
            'Lu, Yuan & McLeod',
          ),
        ],
      },
    ],
  },
  {
    speaker: 'B',
    language: 'en',
    text: 'Ekklesia, look up prior research on automatic meeting summarization, quickly.',
    insights: [
      {
        proposal: {
          kind: 'priorArt',
          pattern: 'explicitRequest',
          title: 'Prior research on automatic meeting summarization',
          query: 'automatic meeting summarization research',
          queryAlternate: '会議 自動要約 研究',
          term: '',
          urgency: 0.9,
          reason: 'Requested by a participant',
          depth: 'quick',
        },
        gist: 'Meeting summarization has been studied since the AMI and ICSI meeting corpora; recent work summarizes transcripts with LLMs (e.g. QMSum).',
        confidence: 0.75,
        verdict: 'none',
        termDefinition: '',
        summary:
          'Research corpora such as AMI (2005) enabled early extractive and abstractive meeting summarization. QMSum (2021) introduced query-based summarization over meeting transcripts; LLM-based summarizers now dominate.',
        bullets: [
          'AMI Meeting Corpus: 100 hours of annotated meetings',
          'QMSum: query-focused meeting summarization benchmark',
          'Open challenge: faithful summaries of multi-party discussion',
        ],
        sources: [
          source(
            'AMI Meeting Corpus',
            'https://groups.inf.ed.ac.uk/ami/corpus/',
            'University of Edinburgh',
            2005,
            'web',
          ),
          source(
            'QMSum: A New Benchmark for Query-based Multi-domain Meeting Summarization',
            'https://arxiv.org/abs/2104.05938',
            'NAACL',
            2021,
            'paper',
          ),
        ],
      },
    ],
  },
  {
    speaker: 'C',
    language: 'en',
    text: "If we store all recordings on our lab server, we don't need consent from participants, right?",
    insights: [
      {
        proposal: {
          kind: 'critique',
          pattern: 'untestedAssumption',
          title: 'Is consent really unnecessary?',
          query:
            'recording meeting participants consent personal information research ethics Japan',
          queryAlternate: '会議 録音 同意 個人情報保護法 研究倫理',
          term: '',
          urgency: 0.8,
          reason: 'A plan rests on an unverified legal assumption',
          depth: 'default',
        },
        gist: "Does storing recordings locally really remove the need to inform participants and get consent under Japan's APPI and ethics rules?",
        confidence: 0.65,
        verdict: 'none',
        termDefinition: '',
        summary:
          'Where data is stored usually does not decide whether consent is needed: voice recordings of identifiable people are personal information, and university research normally needs ethics review and informed consent.',
        bullets: [
          'Recordings of identifiable voices count as personal information',
          'Sending audio to overseas cloud APIs adds cross-border transfer rules',
          "Check your institution's ethics review requirements",
        ],
        sources: [
          source(
            'Personal Information Protection Commission, Japan',
            'https://www.ppc.go.jp/en/',
            'ppc.go.jp',
            null,
            'web',
          ),
        ],
      },
    ],
  },
  {
    speaker: 'A',
    language: 'ja',
    text: 'なるほど。じゃあ、まずは既存サービスを試してから、足りない部分だけ作る方向にしましょう。',
    insights: [],
  },
  {
    speaker: 'B',
    language: 'en',
    text: "Agreed. Let's run a two-week trial with an existing API and measure Japanese accuracy.",
    insights: [],
  },
]

/** The scripted IBIS map, revealed progressively. */
export const DEMO_ISSUE_NODES: readonly DemoIssueNode[] = [
  {
    id: 'q1',
    type: 'question',
    text: '会議記録ツールをどう実現するか',
    parentId: '',
    appearsAfter: 0,
    speakers: ['A'],
  },
  {
    id: 'i1',
    type: 'idea',
    text: '文字起こしパイプラインを自作する',
    parentId: 'q1',
    appearsAfter: 1,
    speakers: ['B'],
  },
  {
    id: 'p1',
    type: 'pro',
    text: '仕組みを完全に制御できる',
    parentId: 'i1',
    appearsAfter: 1,
    speakers: ['B'],
  },
  {
    id: 'q2',
    type: 'question',
    text: '話者をどう区別するか',
    parentId: '',
    appearsAfter: 2,
    speakers: ['C'],
  },
  {
    id: 'i2',
    type: 'idea',
    text: 'ダイアライゼーションも自前で実装する',
    parentId: 'q2',
    appearsAfter: 2,
    speakers: ['C'],
  },
  {
    id: 'i3',
    type: 'idea',
    text: 'Whisperをそのまま使う',
    parentId: 'q1',
    appearsAfter: 4,
    speakers: ['B', 'C', 'A'],
  },
  {
    id: 'c1',
    type: 'con',
    text: 'Whisperは標準ではストリーミング非対応',
    parentId: 'i3',
    appearsAfter: 6,
    speakers: [],
  },
  {
    id: 'q3',
    type: 'question',
    text: '1時間あたりのコストはいくらか',
    parentId: '',
    appearsAfter: 8,
    speakers: ['C'],
  },
  {
    id: 'q4',
    type: 'question',
    text: '録音データに参加者の同意は必要か',
    parentId: '',
    appearsAfter: 11,
    speakers: ['C'],
  },
  {
    id: 'd1',
    type: 'decision',
    text: '既存サービスを試し、不足部分だけ自作する',
    parentId: 'q1',
    appearsAfter: 12,
    speakers: ['A'],
  },
  {
    id: 'i4',
    type: 'idea',
    text: '既存APIで2週間試験し日本語精度を測る',
    parentId: 'q1',
    appearsAfter: 13,
    speakers: ['B'],
  },
]

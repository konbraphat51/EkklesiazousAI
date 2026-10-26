# 同期型音声議論の弱点（情報欠損を中心に）— テキスト・メールとの対比と EkklesiazousAI への設計示唆

- 作成日: 2026-10-27
- 対象システム: EkklesiazousAI（会議の音声をリアルタイムに聴取し、必要な情報を即時に調査して共有キャンバスに提示するエージェント）
- 検証方法: 各文献の書誌情報（著者・年・題名・掲載誌・巻号・頁・DOI）は Crossref / OpenAlex / Semantic Scholar / arXiv / 出版社・機関リポジトリで照合した。主張は原則として抄録または本文で確認した。
  - 【二次】= 原典の抄録・本文を直接確認できず、解説記事・他論文の要約など二次資料でのみ確認した主張。
  - 【未確認】= 一次資料・信頼できる二次資料のいずれでも確認できなかった主張（設計判断の根拠には使わない）。
- 用語: 「同期型音声」= 対面会議・電話・Zoom 等、音声中心のリアルタイム議論。「テキスト媒体」= チャット・メール・GSS（Group Support System; 電子会議システム）・EBS（電子ブレインストーミング）等。CMC = computer-mediated communication。

---

## 1. 目的 / 調査範囲

### 1.1 目的
- 本プロジェクトの動機（「リアルタイム音声議論は情報収集の時間を与えないまま進行し、車輪の再発明や集団浅慮を招く」）を既存研究で裏付け、メカニズム単位に精緻化する。
- 弱点を「エージェントがトランスクリプトから**何を検出し**、**何を**、**いつ**提示すべきか」という要件に落とし込む。
- 同時に、音声議論の**強み**（速い収束、豊かな手がかり、信頼形成）を特定し、エージェントがそれを壊さないための設計制約を導く。

### 1.2 調査範囲
1. メディア理論: メディアリッチネス理論、メディア同期性理論、グラウンディング理論、メディア自然性
2. 集団プロセス・ロス: 発話ブロッキング、評価懸念、社会的手抜き、電子ブレスト / GSS、名目集団
3. 情報プーリングのバイアス: 隠れたプロファイル、共有情報バイアス、共通知識効果、媒体の効果
4. 集団浅慮・同調・アンカリング・早期合意・地位/発言量の偏り・悪魔の代弁者 / 弁証法的探究
5. 聴取の認知的制約: 一過性、作業記憶、発話速度と読字速度、その場で検索・検証できないこと、マルチタスク、Zoom 疲労
6. 車輪の再発明 / Not-Invented-Here（NIH）
7. 反証: 同期型音声が優れる点
8. リアルタイム情報支援・ファクトチェック・LLM による集団意思決定支援（2023–2026 を含む）

### 1.3 結論の先出し
- 音声議論の「情報欠損」は単一の問題ではなく、**(L1) 媒体特性**（一過性・推敲不能・並列性ゼロ・遅延コスト大）、**(L2) 聴き手の認知制約**、**(L3) 社会的圧力**、**(L4) 情報プーリングの統計的偏り**、**(L5) 外部知識へのアクセス欠如**、の 5 層が重なった結果である（§2.8）。
- ただし「テキストに置き換えれば解決」ではない。隠れたプロファイル研究 65 件のメタ分析では、媒体（CMC vs 対面）は独自情報のプーリングにも決定の質にも影響しなかった（Lu, Yuan & McLeod 2012）。テキスト化は並列性・記録性を与える一方、収束の遅延や満足度・信頼形成の低下を伴いうる（§3.3, §4）。
- よって設計原理は **「音声＝収束（convergence）チャネルとして温存し、キャンバス＝伝達（conveyance）チャネルとして並走させる」媒体併用**であり、これはメディア同期性理論の「単一媒体より複数媒体の併用が有利」という提言と一致する（Dennis, Fuller & Valacich 2008）。
- LLM ファシリテータは集団内の情報共有量を増やしたが、それだけでは隠れたプロファイル課題の最終決定は改善しなかった（Alsobay et al. 2026）。GSS でも「情報は増えたが使われなかった」（Dennis 1996）。**「情報を出す」だけでなく「統合・反証・決定前チェック」まで支援する**必要がある。

---

## 2. 理論的枠組み

### 2.1 メディアリッチネス理論（MRT; Daft & Lengel 1986）
- 主張
  - 情報のリッチネスは「一定時間内に理解を変える能力」と定義される。リッチネスの源泉は、即時フィードバック、手がかりとチャネルの数、個人化、言語の多様性。リッチネス順は 対面 > 電話 > 個人文書（手紙・メモ） > 非個人文書 > 数値文書（Daft & Lengel 1986）。
  - リッチな媒体は**多義性（equivocality）**の解消、すなわち異なる解釈枠の調整に適する。リーンな媒体は「よく理解されたメッセージや標準的データ」の処理に有効である（同上）。
  - 管理者は曖昧なメッセージにはリッチ媒体、明確なメッセージにはリーン媒体を選び、高業績の管理者ほどこの対応関係に敏感だった（Daft, Lengel & Treviño 1987）。
- 含意: 音声会議は「解釈のすり合わせ」に適する。一方で「事実・数値・先行事例」のようなデータの伝達には必ずしも最適でない。後者をリーンで再読可能な媒体（キャンバス）に逃がすことは理論的に整合する。
- 限界: 「最もリッチな媒体＝最良」という単一軸の序列は批判され、メディア同期性理論へ拡張された（Dennis & Valacich 1999）。

### 2.2 メディア同期性理論（MST; Dennis & Valacich 1999; Dennis, Fuller & Valacich 2008）
- 主張
  - コミュニケーションは 2 つの基本過程からなる。
    - **伝達（conveyance）**: 情報の交換と、その意味の熟慮。発散的であり、全員が同時に同じ情報に注目する必要はない。
    - **収束（convergence）**: 情報の意味についての共有理解の形成。参加者は意味に合意し、かつ「合意したことに合意する」必要がある。
  - 一般に伝達には低同期性の媒体、収束には高同期性の媒体が適する（Dennis & Valacich 1999; Dennis et al. 2008）。
  - 同期性を左右する媒体能力は 5 つ: 記号セット、**並列性**（同時に有効に存在しうる会話の数）、**伝送速度**、**推敲可能性（rehearsability）**（送信前にメッセージを推敲・微調整できる程度）、**再処理可能性（reprocessability）**（コミュニケーションの中でメッセージを再検討・再処理できる程度）。
  - 1999 年版の媒体特性表では、対面・ビデオ会議・電話は並列性・推敲可能性・再処理可能性がいずれも low。電子メールは推敲可能性・再処理可能性が high である。
  - 熟慮について: 「推論を熟成させれば意味は明確になるが、情報があまりに速く到来し即答が求められると、個人は情報を処理できず習慣的処理やステレオタイプに後退する」（Dennis & Valacich 1999 の要旨）。
  - 多くの集団課題は両過程を必要とするため、単一媒体より複数媒体を併用した方がコミュニケーション成績は向上する（Dennis et al. 2008 抄録）。
- 含意: 本システムは「会議音声（高同期・収束）」に「キャンバス（高並列・再処理可能・伝達）」を重ねる媒体併用の具体化と位置付けられる。
- 注記: 2008 年版本文 PDF は取得できなかったため、能力の定義文は 1999 年版（HICSS）から採った。

### 2.3 コミュニケーションにおけるグラウンディング（Clark & Brennan 1991）
- 主張
  - 会話参加者は、発話が「現在の目的に十分なほど理解された」という相互信念を確立しようとする（グラウンディング）。その際、**最小協働努力**の原理に従い、媒体ごとに最も安価な技法を用いる。
  - 媒体が課す 8 つの制約: 共在（copresence）、可視性、可聴性、**同時性（cotemporality; 産出とほぼ同時に受信）**、同時送受信（simultaneity）、**順序性（sequentiality）**、**再閲覧可能性（reviewability）**、**修正可能性（revisability）**。
    - 再閲覧可能性: 「発話はすぐに消えるが、メール・手紙・録音では人工物として残り、当事者や第三者が後から見返せる」。
    - 修正可能性: 手紙やメールは送信前に私的に修正できる。一方「対面や電話では自己修復の大半を公開で行わねばならない」。
  - グラウンディングの 11 種のコスト: 定式化、産出、受信、理解、開始、**遅延**、非同期、話者交替、表示、誤り、修復。
    - **遅延コスト**: 同時性のある媒体では、短い遅延でも「会話から降りた」「ターンを終えた」と誤解されうるためコストが高い。そのため話し手は即座に発話を組み立てざるを得ず、単純な構文と不完全な発話で妥協する。メールでは遅延コストはほぼゼロ。
    - 受信コスト: 聴くことは一般に容易だが、複雑な指示や抽象的な議論は聴くより読む方が容易な場合がある。
    - 集団化すると開始コスト、受信コスト（誰が話しているかの同定）、誤りと修復のコストが上昇する。
  - 話し手は情報を「反復可能な小分け」で提示する（電話番号の区切りなど）。これは即時記憶の容量制限への暗黙の適応である。
  - 参加者はスケジュールや役割分担などについて「再閲覧可能な記録」を望むことがある。
- 含意: 音声会議は「再閲覧不能・修正不能・遅延不可」の媒体である。そのため**「その場で調べる・考える」行為自体に高い遅延コストが課される**。エージェントが代わりに調べ、結果を再閲覧可能な形で残すことは、この制約を直接補う。

### 2.4 メディア自然性 / 心理生物学的モデル（Kock 2004）
- 主張: 媒体の「自然さ」（対面との類似度）と、知識伝達に要する認知的努力の間には負の因果関係がある。特に**話す・聴くことを支援する程度**が自然さの中心である。この関係は参加者間のスキーマ整合（schema alignment; 背景知識の類似）と媒体への認知的適応によって相殺される。
- 含意: 音声チャネルを損なう介入は認知的努力を増やす。一方、スキーマが不揃いな参加者（専門外・途中参加）は自然な媒体でも努力が大きいため、キャッチアップ支援の理論的根拠になる。

### 2.5 集団プロセス・ロス（Diehl & Stroebe 1987; Nijstad & Stroebe 2006）
- 実集団のブレインストーミングが名目集団（個別作業の合算）に劣る理由として、ただ乗り・評価懸念・**発話ブロッキング**を 4 実験で検討した。直接操作により、ブロッキングが生産性損失の大半を説明した（Diehl & Stroebe 1987, 実験 4）。
- SIAM モデル: アイデア生成は連想記憶の反復探索である。ターンテイキング（＝ブロッキング）は知識活性化とアイデア産出の両段階を妨げる。一方、**他者のアイデアは問題関連知識の活性化を助ける**（Nijstad & Stroebe 2006）。後者は音声議論の正の側面である。

### 2.6 偏ったサンプリングモデルと共通知識効果（Stasser & Titus 1985; Gigone & Hastie 1993）
- 議論は (a) 成員が事前に共有している情報と (b) 既存の選好を支持する情報に支配されやすく、成員は情報を効果的にプールできない。討議は成員の歪んだ理解を「訂正するより永続させる」傾向がある（Stasser & Titus 1985）。
- 事前に全員が持っている情報ほど集団判断への影響が大きい（共通知識効果）。この影響は成員の事前判断を介して媒介される（Gigone & Hastie 1993）。

### 2.7 認知負荷理論と一過性情報効果（Cowan 2001; Leahy & Sweller 2011）
- 作業記憶の中心的な容量制限は約 4 チャンクである（Cowan 2001）。
- 長い聴覚テキストは一過性のため作業記憶で処理しきれない。通常は有利な「音声説明＋図」が「文字説明＋図」より劣るという逆転が起き、説明を短くすると逆転は消えた（Leahy & Sweller 2011）。→ 長く複雑な情報は、音声より持続的な視覚表示の方が有利。

### 2.8 統合: 情報欠損の 5 層モデル（本ノートの整理）

| 層 | 内容 | 音声固有か | 主な根拠 |
|---|---|---|---|
| L1 媒体特性 | 一過性（再閲覧不能）、推敲不能、並列性ゼロ、遅延コスト大 | 固有 | Clark & Brennan 1991; Dennis & Valacich 1999 |
| L2 認知制約 | 作業記憶の容量、ペースを制御できない、検索・検証との二重課題 | 主に固有 | Cowan 2001; Leahy & Sweller 2011; Piolat et al. 2005 |
| L3 社会的圧力 | 評価懸念、地位・支配、同調、集団浅慮 | 対面で強いがテキストにも残る | Asch 1956; Janis 1972; Dubrovsky et al. 1991; Hollingshead 1996 |
| L4 プーリングの偏り | 共有情報バイアス、選好先行、アンカー | 媒体非依存 | Stasser & Titus 1985; Lu et al. 2012; Whyte & Sebenius 1997 |
| L5 外部知識の欠如 | 先行事例・データへのアクセスが会話中にない | 音声で特に顕著（調べる遅延コスト大） | Katz & Allen 1982; Robinson & Goodman 2011 |

- L1–L2 は「音声という媒体」に、L3–L4 は「集団」に起因し、L5 は「その場で調べられない」ことに起因する。L5 と L4 が本システムの中心的な介入点であり、L1–L2 は提示方法の制約条件になる。

---

## 3. 弱点の分類（タクソノミー）

### 3.1 一覧表

| ID | 弱点 | メカニズム | 主な証拠 | テキスト・メールとの対比 | 本システムでの対策案 |
|---|---|---|---|---|---|
| W1 | 発話の一過性 | 音声は即座に消え、聞き逃し・忘却が回復しない。長い説明は作業記憶を溢れさせる | Clark & Brennan 1991; Dennis & Valacich 1999; Leahy & Sweller 2011; Cowan 2001 | メール・チャットは人工物として残り再読できる | 主張・数値・決定を逐次キャンバスに固定し、外部記憶とする |
| W2 | 即答圧力・推敲不能 | 遅延コストが高く、単純で不完全な発話になる。速すぎる情報流で習慣的処理・ステレオタイプに後退する | Clark & Brennan 1991; Dennis & Valacich 1999 | 送信前に推敲・下調べできる（遅延コストほぼゼロ） | 「考える・調べる時間」をエージェントが肩代わりし、保留中の問いを後で再提示する |
| W3 | 並列性ゼロ・発話ブロッキング | 一度に一人しか話せず、順番待ちの間にアイデアを忘れる・取り下げる | Diehl & Stroebe 1987; Mullen et al. 1991; Nijstad & Stroebe 2006 | EBS は大集団で名目集団を上回る（Gallupe et al. 1992; Dennis & Valacich 1993） | キャンバスに並列入力レーンを設け、発言されず書かれた案もエージェントが拾う |
| W4 | 評価懸念・沈黙 | 否定的評価を恐れて発言・異論を控える。心理的安全性が低いと学習行動が減る | Diehl & Stroebe 1987（実験2）; Edmondson 1999; Gallupe et al. 1992 | 匿名の GSS は評価懸念を下げうる | 匿名の質問・異論投稿。異論をエージェントが代弁し個人帰属を外す（Lee et al. 2025） |
| W5 | 社会的手抜き | 集団作業で個人の努力が下がる | Karau & Williams 1993 | 媒体非依存。ログで貢献が可視化される点は異なる | 参加の最低水準を引き上げる問いかけ（Alsobay et al. 2026）。貢献の可視化は慎重に |
| W6 | 共有情報バイアス（隠れたプロファイル） | 共有情報ばかり語られ、一人しか知らない情報が出ない・使われない | Stasser & Titus 1985; Gigone & Hastie 1993; Lu et al. 2012; Mesmer-Magnus & DeChurch 2009 | 媒体の効果はメタ分析で有意差なし（Lu et al. 2012）。GSS は交換量↑でも利用されず（Dennis 1996） | 未言及の論点・情報を可視化（情報カバレッジ）。事前に各自の独自情報を収集し、未出の情報を提示する |
| W7 | 選好先行の議論 | 冒頭で他者の選好を知ると、交換される情報への注意が減る | Mojzisch & Schulz-Hardt 2010; Schulz-Hardt et al. 2006 | テキストでも起こる（媒体非依存） | 冒頭の立場表明を検出したら「情報出し→評価」の順序を提案。異論の存在を可視化 |
| W8 | 地位・支配・発言量の偏り | 高地位者が議論と「最初の提案」を支配する。低地位者の重要情報が参照されない | Dubrovsky et al. 1991; Hollingshead 1996; Woolley et al. 2010; Karpowitz et al. 2012 | メールで参加・影響が平準化（Dubrovsky et al. 1991）。ただし地位の効果は媒体を問わず残る（Hollingshead 1996） | 話者分離で発話時間の偏りを推定し、未発言者の情報を引き出す匿名の問いを提示（名指しは避ける） |
| W9 | 同調・集団浅慮・早期合意 | 全員一致の圧力、自己検閲、凝集性。早すぎる解の採用 | Asch 1956; Bond & Smith 1996; Janis 1972; Esser 1998; Nemeth et al. 2001 | 匿名テキストは地位の手がかりを弱めるが、同調そのものの媒体差は本調査では未確認 | 合意シグナルを検出したら反証・代替案・前提リストを提示。外部の実在する反対意見・反例を出典付きで |
| W10 | アンカリング・最初の案への収束 | 最初に出た数値・提案・多数派が判断を規定する | Tversky & Kahneman 1974; Whyte & Sebenius 1997; de Wilde et al. 2018; Dubrovsky et al. 1991 | 集団でも個人並みにアンカーされ、媒体による解消は確認されていない | 最初の数値・案を検出し、参照クラス（類似事例の分布）や代替案を提示。判断根拠の記録を促す |
| W11 | 会話中に調べられない・検証できない | 調べる行為は遅延コスト・タスク切替コストを生み、会話から脱落する | Clark & Brennan 1991; Porcheron et al. 2016; Cao et al. 2021; Monsell 2003; Piolat et al. 2005 | 返信前に調べられる | エージェントが代理検索し、結果をグランス可能なカードで提示（Andolina et al. 2018; Rhodes & Maes 2000） |
| W12 | 車輪の再発明・NIH | 外部知識への接触が減る、外部知識を忌避する、先行研究が参照されない | Katz & Allen 1982; Antons & Piller 2015; Hansen 1999; Robinson & Goodman 2011; Chalmers & Glasziou 2009 | 媒体非依存。ただし音声ではその場で確認する時間がない | 新規アイデアの提案を検出し、先行事例（論文・特許・製品・社内資料）を自動検索して提示 |
| W13 | 情報格差のある参加者の追従困難 | 共通基盤（スキーマ）の不足。理解できないまま議論が進み、遡れない | Clark & Brennan 1991; Kock 2004（理論的推論が中心） | テキストは自分のペースで読み返し、調べながら読める | 用語・略語・前提の自動注釈と、途中参加者向けの「ここまでの要約」 |
| W14 | ビデオ会議特有の負荷 | 伝送遅延によるターン交替の崩れ、非言語の過負荷、画面への視覚的集中 | Boland et al. 2022; Schoenenberg et al. 2014; Bailenson 2021; Fauville et al. 2021, 2023; Brucks & Levav 2022 | 非同期テキストにはこの負荷がない | 音声で割り込まない。キャンバスはグランス可能にし、アイデア生成フェーズでは控えめに表示 |
| W15 | 議題逸脱・論点の散逸 | 議論は非線形に展開するが、記録は線形。目標が不明確だと逸脱する | Chen, Tankelevitch et al. 2025; Chen, Yap et al. 2025（MeetMap）; Chandrasegaran et al. 2019 | スレッドや議題で構造化しやすい | 議題マップ・論点ツリーをリアルタイムに生成し、逸脱はパッシブに表示 |
| W16 | 記録・決定事項の欠落 | 記録には再閲覧可能な媒体が必要だが、ノート取りは認知的に重い | Clark & Brennan 1991; Piolat et al. 2005 | ログが残る | 決定・宿題・未解決の問いのログを自動生成し、会議後にレビューできるようにする |

### 3.2 弱点別の証拠ノート（主要な数値と注意点）

#### W1–W3: 媒体特性と発話ブロッキング
- 名目集団との比較メタ分析: ブレインストーミング集団は名目集団より量・質とも有意に生産性が低い。損失は (a) 大きな集団、(b) 実験者の同席、(c) **アイデアを口頭で録音する条件（記述と比べて）**、(d) 完全に一人の名目集団との比較で強かった（Mullen, Johnson & Salas 1991）。→ 「声に出す」こと自体が損失要因の一つ。
- 電子ブレスト: 2・4・6 人集団と 6・12 人集団の 2 実験で、大きな集団ほど電子ブレストで固有かつ高品質のアイデアが多く、満足度も高かった。差は小集団で小さかった。著者らは発話ブロッキングと評価懸念の低減に帰属している（Gallupe et al. 1992）。12 人の電子ブレスト集団は 12 人の名目集団より多くのアイデアを出し、6 人では差がなかった（Dennis & Valacich 1993）。
- 電子ブレストのメタ分析: 電子ブレスト集団は対面集団より生産的で満足度が高い。大集団では名目集団を上回り、小集団では名目集団が上回った（DeRosa, Smith & Hantula 2007【二次: 抄録の転載ページで確認】）。
- 一過性: 長い聴覚テキストは一過性情報効果により学習を損なう（Leahy & Sweller 2011）。
- 発話速度と読字速度: 英語成人の黙読は平均 238 wpm（ノンフィクション）、音読は 183 wpm（Brysbaert 2019）。会話音声の速度は計算方法により約 164–236 wpm（Yuan, Liberman & Cieri 2006【二次: 発表スライドで確認】）。Brysbaert は「読字速度は最大聴取速度とほぼ同水準」と述べる。
  - **注意**: 平均速度だけ見れば音声が遅いとは言えない。問題は速度ではなく、**ペースを聞き手が制御できないこと**（読み返し・飛ばし読み・一時停止ができない）と**再閲覧できないこと**である。

#### W4–W8: 情報プーリングと地位
- 隠れたプロファイルのメタ分析（65 研究、101 効果、3,189 集団）: (a) 集団は独自情報より共通情報を約 2 標準偏差多く言及した。(b) 隠れたプロファイル条件の集団は、全情報を持つ集団より正解に至る可能性が **8 分の 1** だった。(c) 情報カバレッジ（利用可能な独自情報のうち言及された割合）と議論フォーカス（議論中の独自情報の割合）はどちらも決定の質と正に関連し、前者の方が強かった。(d)(e) **媒体は独自情報のプーリングにも決定の質にも影響しなかった**（Lu, Yuan & McLeod 2012）。
- 情報共有のメタ分析（72 研究、4,795 集団）: 情報共有はチーム成績を予測する。共有は課題の論証可能性・議論の構造化・協力で促進され、情報分布・情報的相互依存・成員の異質性で阻害される（Mesmer-Magnus & DeChurch 2009）。「よく話す集団ほど独自情報の共有が少ない」という解説がある【二次: BPS Research Digest】。
- 仮想性のメタ分析（94 研究）: 仮想性は独自情報の共有を**改善**するが、共有の開放性を**阻害**する。関係は曲線的で、低い仮想性は共有を改善し、高い仮想性は阻害する（Mesmer-Magnus et al. 2011）。
- 冒頭で他者の選好を知ると、交換される情報への注意が減り、隠れたプロファイルの解決率が下がる。対面の 3 人集団でも再現した（Mojzisch & Schulz-Hardt 2010）。
- 事前の選好が多様（異論あり）な集団は、全員が同じ誤った選好を持つ集団より解決率が高い。その効果は主に議論の強度の増加と、議論バイアスの若干の減少で媒介された（Schulz-Hardt et al. 2006）。→ **異論は情報欠損の解毒剤**であり、エージェントの devil's advocate 機能の根拠となる。
- 地位と媒体: 対面では高地位者が議論を支配し、「最初の提案者」になりやすく、最初の提案者はより影響力が大きかった。電子メールでは参加と影響の不平等が縮小し、最初の提案が低地位者にも分散した（Dubrovsky, Kiesler & Sethna 1991）。
- 地位の持続: 重要情報を低地位者だけに与えた混合地位の集団は、媒体にかかわらず決定が劣り、重要情報への言及も少なかった。CMC は情報交換そのものを抑制した（Hollingshead 1996）。
- 集合知: 集団課題の成績に共通する因子 c は、成員の社会的感受性、**会話ターンの均等さ**、女性比率と相関した（699 人、2–5 人集団; Woolley et al. 2010）。一人が支配する集団は c が低いと著者らは説明している【二次: プレスリリース】。
- 熟議での発言のジェンダー格差は大きいが、決定規則と構成（全会一致かつ女性少数、または多数決かつ女性多数）によって消える（Karpowitz, Mendelberg & Shaker 2012）。
- 心理的安全性は学習行動と関連し、学習行動はチーム成績への効果を媒介する（51 チーム; Edmondson 1999）。

#### W9–W10: 同調・集団浅慮・アンカー・異論の技法
- Asch の線分判断課題: 全員一致の多数派への同調は重要試行の約 1/3、少なくとも 1 回同調した参加者は約 3/4、同調しない協力者が一人いると同調は大きく減る【二次: 数値は解説資料経由で、1956 年モノグラフ本文は未照合】。
- 同調のメタ分析（133 研究、17 か国）: 米国では 1950 年代以降、同調は低下している。**集団主義的な国ほど同調が高い**（Bond & Smith 1996）。→ 日本語の会議では同調圧力への対策の重要度が高いと推測される。
- 集団浅慮: Janis は凝集性の高い孤立した集団で、不敗の幻想・自己検閲・全員一致の幻想・「マインドガード」などの症状が生じるとした。対策として、悪魔の代弁者の任命、外部専門家の招請、リーダーの中立、「二次検討会議（second-chance meeting）」を提案した【二次: 症状と対策の列挙は解説資料経由】（Janis 1972）。実証研究は少なく、検証された変数も限られる（Esser 1998 のレビュー【二次】）。→ 集団浅慮は「モデル」としてではなく、個々の検証済みメカニズム（同調・共有情報バイアス・異論の抑制）の束として扱う。
- 集団分極化: 集団討議は成員の当初の傾向を強める方向に意見をシフトさせうる（Myers & Lamm 1976 のレビュー）。
- アンカー: 交渉直前に与えた信頼性の低いアンカーは、個人と同程度に集団にも効いた（MBA 学生 105 人、経験ある管理者 135 人）。集団決定は討議開始時の多数派の見解を反映し、多数派がなければ個人推定の平均に落ち着いた（Whyte & Sebenius 1997【抄録は二次資料経由】）。協力的な集団はアンカーの影響を受けたが、プロセスへの説明責任や競争的動機づけで緩和された（de Wilde, ten Velden & De Dreu 2018【二次: リポジトリの抄録】）。
- 悪魔の代弁者（DA）と弁証法的探究（DI）:
  - DI と DA はいずれも、合意（consensus）アプローチより質の高い推奨と前提を生んだ（Schweiger, Sandberg & Ragan 1986; Schweiger, Sandberg & Rechner 1989）。ただし 1989 の研究では、DI・DA 群は決定の受容度が低かった【1986 の抄録全文と 1989 の詳細は二次】。
  - 既往研究の要約として、DA と DI はどちらも対立のない専門家アプローチより集団成績を改善するとされる。対面と CMC を比較した実験では、DA 群が DI 群・専門家群より多くの代替案を生成・検討し、質の高い推奨を選んだ。CMC 群は代替案が多かったが、合意までの投票回数も多かった（Valacich & Schwenk 1995【二次: 機関リポジトリの抄録】）。
  - Schwenk (1990) のメタ分析の具体的な効果量は【未確認】。
  - **ロールプレイの DA は本物の少数意見に劣る**。DA は初期見解の認知的補強を招きやすく、本物の少数派は 3 種の DA 条件すべてより解の量・質を高めた（Nemeth, Brown & Rogers 2001）。

#### W11, W13–W14: 聴取とビデオ会議の認知的制約
- ノート取りは、新情報を理解しながら要点を選び記録するという時間的切迫のため作業記憶（中央実行系）への要求が大きく、読書や学習より努力を要する（Piolat, Olive & Kellogg 2005）。→ 会議中に人間が「記録しながら調べる」のは非現実的。
- タスク切替には切替コストが伴う（Monsell 2003）。
- パブでの会話中のスマートフォン使用（検索を含む）は会話との「織り交ぜ」に相互行為上の問題を生み、参加者は使用を正当化する説明を必要とした（Porcheron, Fischer & Sharples 2016）。→ 人間が会話中に自分で調べることには社会的コストもある。
- リモート会議のマルチタスク（Microsoft 社員のテレメトリ＋715 人の日誌調査）: 会議の規模・長さ・時間帯・種類がマルチタスクの程度と有意に相関し、マルチタスクは正負両方の結果をもたらした（Cao et al. 2021）。会議の約 30% でメールのマルチタスクがあったという要約がある【二次】。
- 外部アクセスを期待すると、人は情報そのものより「どこにあるか」をよく記憶する（Sparrow, Liu & Wegner 2011）。→ 常時の代理検索は、参加者自身の記憶・理解を浅くするリスクがある。
- Zoom の伝送遅延: Q&A パラダイムで応答潜時はローカル 297 ms に対し Zoom 976 ms。対面会話でのターン交替は平均 135 ms、同じペアの Zoom では 487 ms。30–70 ms の伝送遅延をはるかに超える乱れである（Boland et al. 2022）。
- 遅延の誤帰属: 1.2 秒の伝送遅延があると、相手は遅延なし条件より注意深くない・友好的でない・自制的でないと評価された（Schoenenberg, Raake & Koeppe 2014【二次: 著者による解説記事】）。
- Zoom 疲労: 近距離の過剰なアイコンタクト、自己映像、移動の制限、非言語の産出・解釈の負荷の 4 要因が提案されている【4 要因の名称は二次: 大学の広報記事】。ただし**理論的議論であり直接検証は今後の課題**と著者自身が明記している（Bailenson 2021）。ZEF 尺度の検証では頻度・時間・連続性が疲労と関連した（Fauville et al. 2021）。9,787 人の調査では、自己映像への不安・多数の顔からの視線・身体的拘束・非言語の産出/監視の努力が疲労を高め、女性でより強かった（Fauville et al. 2023）。
- ビデオと創造性: 実験室実験と 5 か国のフィールド実験で、ビデオ会議は対面より創造的アイデアの生成を抑制した。視線計測などから、画面に視覚的焦点が絞られ認知的焦点が狭まることが示唆された。一方、**アイデア選択でビデオ群が劣る証拠はなかった**（Brucks & Levav 2022）。→ キャンバスが画面凝視をさらに強めると、生成フェーズの害を増幅する懸念がある。

#### W12: 車輪の再発明 / NIH
- 大規模研究所の 50 の R&D プロジェクト群では、チームの在籍期間が約 1.5 年まで成績が上がり、5 年までに顕著に低下した。これは成員間および**重要な外部情報源とのコミュニケーション率の低下**で最もよく説明された（Katz & Allen 1982）。
- NIH は外部由来の知識（アイデア・技術）への否定的態度であり、有用な知識でも「外部」と知覚されると拒否されうる（Antons & Piller 2015）。
- 新製品開発 120 件の分析で、弱い部門間の紐帯は他部門の有用な知識の**探索**を助けるが、複雑な知識の**移転**を妨げた（Hansen 1999）。→ 「見つける」ことと「使える形で渡す」ことは別問題である。
- 先行研究の不参照: 227 のメタ分析に含まれる 1,523 の RCT を調べると、先行試験の引用率の中央値は 0.21（関連試験の 1/4 未満）だった。引用可能な先行試験が 5 件以上ある 1,101 試験のうち 23% は先行 RCT を 1 件も引用しなかった（Robinson & Goodman 2011）。
- 研究の浪費: 健康研究の約 85% が回避可能な形で浪費されているとの推計（Chalmers & Glasziou 2009）。研究課題の選択段階での浪費を含む【数値の内訳は二次】。
- 知識労働者は週の約 20% を社内情報の探索や協力者探しに費やすという推計がある（McKinsey Global Institute 2012; 業界レポート、査読なし）。
- 「EU の R&D 支出の最大 30%（年 200–250 億ユーロ規模）が既存特許の再発明に浪費されている」という欧州特許庁（EPO）由来とされる数値は広く流通している。しかし一次資料を確認できず、出典（英国特許庁・EPO）や金額にも揺れがある【未確認】。

### 3.3 「テキストにすれば解決」ではない証拠（対比の注意点）
- 隠れたプロファイルでは、媒体は独自情報のプーリングにも決定の質にも影響しなかった（Lu et al. 2012）。
- CMC は情報交換を抑制し、地位による劣化は媒体を問わず残った（Hollingshead 1996）。
- GSS 群は口頭群より約 50% 多く情報を交換し、全群が最適解を同定できるだけの情報を得た。しかし最適解を選んだのは 1 群のみで、情報は処理されなかった（Dennis 1996【抄録の要約で確認】）。
- 一方、GDSS 群は、対立する情報を持つ条件で独自情報をより多く共有し、批判的議論も多く、隠れたプロファイルの正解選択で対面群を上回った（Lam & Schaubroeck 2000）。→ 構造化されたテキスト支援が有効な条件はある。
- CMC は対面と比べて集団の有効性が低く、所要時間が長く、満足度が低い。ただし匿名性や時間無制限などの条件で負の効果が消えるという要約がある（Baltes et al. 2002【二次: メタ分析抄録は未取得】）。
- メールでは皮肉や感情の伝達を送り手が過大評価する（自己中心性; Kruger et al. 2005）。
- 仮想性は独自情報共有を改善する一方で開放性を損なう（Mesmer-Magnus et al. 2011）。
- 結論: 弱点 L1–L2（媒体）はテキストで緩和されるが、L3–L4（集団）は媒体を変えても残る。さらに収束・関係形成のコストが増える。**音声を置き換えるのではなく、音声に並走する再閲覧可能・並列・構造化されたチャネルを足し、L3–L4 には能動的な介入（異論・未出情報の提示）を行う**のが妥当である。

---

## 4. 音声会議の強み（残すべき点）

| 強み | 証拠 | 設計上の制約（エージェントが守るべきこと） |
|---|---|---|
| 収束・多義性の解消に強い | 収束には高同期性が適する（Dennis et al. 2008）。多義的な問題にはリッチ媒体が適し、高業績の管理者ほど使い分ける（Daft & Lengel 1986; Daft et al. 1987） | 合意形成の会話を中断しない。収束フェーズでは介入を減らす |
| 速い | 口頭モードのチームはハードコピー（手書き・タイプ）モードの約 2 倍の速さで問題を解き、4–5 倍の語数を産出した（Chapanis らの一連の研究、Ochsman & Chapanis 1974 を含む【数値は二次: 同グループの技術報告】） | エージェントの処理で議論のテンポを遅らせない。提示は非同期かつ視覚的に |
| 産出・話者交替・修復のコストが低い | 話すことは速く、対面の話者交替コストは低く、自己修復は即時に行われる（Clark & Brennan 1991） | 音声への割り込みは話者交替コストを破壊するため、原則として行わない |
| 信頼形成 | 社会的ジレンマ課題で、ビデオ・音声・対面はテキストチャットより有意に協力的だった。ただし遅延した・脆い信頼が見られた（Bos et al. 2002）。電子的文脈で崩れた信頼は、事前の対面接触で回復した（Rocco 1998） | 対立を扱う介入（DA 等）は関係を壊さない言い回しにする。人の声による議論を主役に |
| 声は「心」を伝え、対立を和らげる | 同じ主張でも、声で聞くと文字で読むより有能・思慮深く評価される（Schroeder & Epley 2015）。意見が対立する相手でも、声で聞くと「より人間的な心」を持つと評価される（Schroeder, Kardas & Epley 2017）。声を含むやりとりは、ぎこちなさを増やさずに強い社会的絆を生む（Kumar & Epley 2021） | 反対意見をエージェントの文字だけで突きつけると、相手を軽んじる知覚を招きうる。「人が声で反論する」きっかけを作る方が望ましい |
| 他者の発言が知識を活性化する | 他者のアイデアは問題関連知識の活性化を助ける（Nijstad & Stroebe 2006） | 参加者の発言を引き出す方向の介入（問い）を優先する |
| 対面はアイデア生成に強い | 対面ペアはビデオペアより創造的アイデアが多い（Brucks & Levav 2022） | オフライン会議では参加者の視線を画面に縛らない。共有ディスプレイは周辺視で読める密度に |
| 自然さ | 話す・聴くことの支援が媒体の自然さの中心であり、自然さが低いほど認知的努力が増える（Kock 2004） | 参加者に「エージェントへの入力作業」を強いない（受動的聴取を基本とする） |

- 補足: CMC 群は代替案を多く出すが、合意までの投票回数が多い（Valacich & Schwenk 1995【二次】）。収束が速いのは音声の利点である。

---

## 5. 設計への示唆

### 5.1 設計原則
- **P1 媒体併用**: 音声は収束（意味のすり合わせ・合意）に、キャンバスは伝達（事実・データ・先行事例・論点一覧）に割り当てる（MRT/MST）。エージェントの主出力はキャンバスへの視覚的・非同期的提示とする。
- **P2 キャンバス＝外部記憶**: キャンバスは音声に欠ける再閲覧可能性・再処理可能性・並列性を補うものとして設計する（Clark & Brennan 1991; Dennis & Valacich 1999）。長文は避け、短い見出し＋要点＋出典の「小分け」にする（作業記憶 4 チャンク; Cowan 2001）。
- **P3 割り込まない**: 音声での割り込みはターン交替の秩序を壊す（Boland et al. 2022）。通知はブレークポイントに遅延させるとフラストレーションと反応時間が減る（Iqbal & Bailey 2008）。中断のタイミングは感情状態と社会的帰属に影響する（Adamczyk & Bailey 2004）。会議 AI では、パッシブなフィードバックは集中を助け、アクティブな介入は流れを乱しうる（Chen, Tankelevitch et al. 2025）。エージェントの存在は歓迎されるが、支配的になると嫌われ、制御手段が求められる（Houde et al. 2025）。
- **P4 AI 自身がアンカー・同調源にならない**: 意見を持つ言語モデルは利用者の表明意見と態度を変える（Jakesch et al. 2023）。生成 AI のアイデアは個人の創造性を上げるが、集団の多様性を下げる（Doshi & Hauser 2024）。AI の提案への過信は説明の付与だけでは減らず、認知的強制（cognitive forcing）で減るが主観評価は下がる（Buçinca et al. 2021）。→ 単一の結論ではなく複数の選択肢・根拠・確信度・反証を出し、決定は人に委ねる。
- **P5 本物の異論を増幅する**: ロールプレイの DA は本物の少数意見に劣る（Nemeth et al. 2001）。異論の存在が隠れたプロファイルの解決を助ける（Schulz-Hardt et al. 2006）。→ エージェントの反論は「AI の意見」ではなく、(a) 実在する反対の証拠・反例・失敗事例、(b) 参加者が書いた少数意見の増幅、(c) 未検討の前提の列挙、として出す。LLM の DA は AI 推奨への適切な依存を促し（Chiang et al. 2024）、地位差のある集団で特に下位者の満足度を高めた（Lee et al. 2025）。
- **P6 情報の「量」より「統合」**: 情報共有を増やしても決定は変わらないことがある（Dennis 1996; Alsobay et al. 2026）。提示した情報が選択肢の評価にどう効くか（評価表・トレードオフ）まで構造化する。
- **P7 参加者の理解を代替しない**: 常時代理検索は「どこにあるか」だけを覚えさせるリスクがある（Sparrow et al. 2011）。要約は参加者の発言への参照（誰が何を言ったか）と結び付け、会議後の振り返りで再処理できるようにする。

### 5.2 検出トリガーと介入（トランスクリプト上で何を検出し、何を、いつ出すか）

| # | トリガー | トランスクリプト上の検出シグナル（例） | 対応弱点 | 提示内容 | タイミング | 主な根拠 |
|---|---|---|---|---|---|---|
| T1 | 検証可能な事実主張 | 数値・統計・固有名詞・断定（「〜は○%だ」「A 社はもうやってる」） | W2, W11 | 出典付きの検証カード（支持 / 反証 / 不明）。評価ラベルより根拠を前面に | 即時にキャンバスへ（パッシブ）。重大な誤りは次のブレークポイントでハイライト | Hassan et al. 2017; Venktesh & Setty 2024; Garrett & Weeks 2013 |
| T2 | 新規アイデア・提案 | 「〜を作ろう」「〜という方式はどう？」「新しく〜」 | W12 | 先行事例カード（論文・特許・製品・OSS・社内資料）。類似度と相違点を付ける | 提案から数十秒以内にパッシブ表示（目標値は仮説） | Katz & Allen 1982; Robinson & Goodman 2011; Shi et al. 2017 |
| T3 | 既存性・事例への問い | 「前に誰かやってなかった？」「他社事例は？」「〜ってあったっけ」 | W11, W12 | 回答カード（検索結果の要約と出典） | 即時 | Andolina et al. 2018; Rhodes & Maes 2000 |
| T4 | 理解の欠落 | 未知語・略語・専門用語、聞き返し（「それって何？」）、途中参加の検知 | W1, W13 | 用語注釈、前提の説明、「ここまでの要約」（個人ビューも可） | 即時（パッシブ） | Clark & Brennan 1991; Kock 2004 |
| T5 | 早期収束 | 同意の連鎖（「いいね」「それで」）、反対ゼロのまま決定表現、検討時間の短さ、代替案が 1 つだけ | W9, W10 | 反証・代替案・前提のリスト、失敗事例、決定前チェックリスト | 決定表現の直前・直後のブレークポイント。必要時のみハイライト | Janis 1972; Nemeth et al. 2001; Schweiger et al. 1986 |
| T6 | 発言量の偏り | 話者分離による発話時間の偏り（例: ジニ係数）、長時間未発言の参加者 | W4, W8 | 匿名で答えられる問い（「この観点の情報を持っている人は？」）、発言分布の控えめな表示 | トピック境界で。個人名の名指しは避ける | Woolley et al. 2010; DiMicco et al. 2007; Kim et al. 2008; Houtti et al. 2025 |
| T7 | 共有情報への偏り | 同じ論点の反復、新規エンティティ率の低下、事前収集した独自情報の未言及 | W6 | 「まだ出ていない情報・論点」一覧（情報カバレッジの可視化） | 議論中盤と決定前 | Lu et al. 2012; Stasser & Titus 1985 |
| T8 | 選好先行 | 冒頭での立場表明・多数決の提案（「私は A 派」「とりあえず手を挙げて」） | W7 | 「情報出し→評価→決定」の順序の提案、各選択肢の根拠表 | 冒頭〜序盤 | Mojzisch & Schulz-Hardt 2010 |
| T9 | アンカー | 最初に出た数値・見積り・案に後続の発言が収束 | W10 | 参照クラスの分布、独立推定の促し、代替アンカー | 数値の初出直後（パッシブ） | Tversky & Kahneman 1974; Whyte & Sebenius 1997; de Wilde et al. 2018 |
| T10 | 権威・地位による論証 | 「部長が言うなら」「専門家だから」等 | W8, W9 | 根拠要求カード（主張の根拠・反証の有無） | パッシブ | Dubrovsky et al. 1991; Hollingshead 1996 |
| T11 | 議題逸脱 | アジェンダ項目との意味的関連度の低下、目標未設定 | W15 | 議題マップ上で現在位置と逸脱を表示 | パッシブのみ | Chandrasegaran et al. 2019; Chen, Tankelevitch et al. 2025 |
| T12 | 保留・宿題 | 「後で調べよう」「誰かが確認して」 | W2, W16 | 保留中の問いリストへの登録と、裏での自動調査。結果は後で提示 | 即時登録、結果は次のブレークポイント | Clark & Brennan 1991 |
| T13 | 決定・アクション | 「〜に決定」「〜さんが〜までに」 | W16 | 決定ログ・アクションアイテム（根拠と未解決リスクを添える） | 即時（パッシブ） | Clark & Brennan 1991; Piolat et al. 2005 |

- 検出上の注意
  - T5・T6・T8 は社会的に敏感である。参加者は AI の批判的フィードバックを合理化して退けることがあり（Houtti et al. 2025）、介入の頻度と口調の調整が必要である（Lee et al. 2025）。
  - 態度に関わる主張の即時訂正は、その主張を支持する人に情報源への不信を招きうる（Garrett & Weeks 2013）。T1 は「誤り」ラベルより、中立的な証拠の提示を優先する。
  - 話者分離（ダイアライゼーション）の誤りは T6 の誤検出に直結する。オフライン会議（ルームマイク 1 本）では精度の限界を前提に、個人単位ではなく集団単位の指標を優先する。

### 5.3 提示内容（カードの型）
- **Fact カード**: 主張の引用（話者・時刻）/ 判定（支持・反証・不明）/ 根拠 1–3 件と出典 / 確信度。
- **Prior-art カード**: 提案の要約 / 類似事例 1–3 件（名称・年・出典）/ 共通点と相違点 / 「差分として何が新しいか」の問い。
- **Glossary / Catch-up カード**: 用語の 1 行定義、ここまでの論点 3 点、決定済み事項。
- **Counterpoint カード**: 反証・代替案・失敗事例、未検討の前提、出典。「AI の意見」ではなく「外部の事実・他者の見解」として提示する。
- **Unshared-info / Open-questions カード**: 未言及の論点、保留中の問い、事前アンケートで得た独自情報（匿名化）。
- **Agenda map / Decision log**: 議題ごとの進捗、決定・アクション・根拠・残存リスク。
- 共通ルール: 1 カード = 見出し 1 行＋本文 2–3 行＋出典。長文は折りたたむ（一過性・作業記憶への配慮; Leahy & Sweller 2011; Cowan 2001）。すべてのカードに発言のタイムスタンプを紐付け、会議後に再処理できるようにする（reprocessability）。

### 5.4 タイミングポリシー
- **Tier 0（常時・パッシブ）**: カードをキャンバスへ静かに追加する。音もポップアップも出さない。T1–T4, T9–T13 の既定。
- **Tier 1（ブレークポイント）**: トピック境界、数秒以上の沈黙、議題の切替、決定表現の直後に、該当カードをハイライトする。T5–T8 の既定（Iqbal & Bailey 2008; Adamczyk & Bailey 2004）。
- **Tier 2（能動）**: 重大な事実誤りが決定の根拠になっている場合や、決定直前に未検討の重大リスクがある場合のみ。会議あたりの回数に上限を設け、ユーザーが調整できるようにする（Houde et al. 2025; Chen, Tankelevitch et al. 2025）。音声での割り込みは既定で無効にする。
- フェーズ適応: アイデア生成フェーズでは表示を減らす（画面への視覚的集中が生成を阻害しうる; Brucks & Levav 2022）。評価・選択フェーズでは Fact / Counterpoint / Unshared-info を増やす。
- タイミング判断の実装: 「内的思考を持ち、適切な瞬間を探す」型のプロアクティブ・エージェント（Liu et al. 2025）や、「いつ応答するか」を小モデルで判定する構成（LlamaPIE; Chen, Batchelder et al. 2025）が参考になる。

### 5.5 評価指標（実装後の検証計画）
- 情報カバレッジと議論フォーカス（Lu et al. 2012 の 2 指標）: 利用可能な独自情報のうち言及された割合、議論中の独自情報の割合。
- 隠れたプロファイル課題の正答率: 情報量の増加が決定改善に結び付くか（Alsobay et al. 2026 の未達点）。
- 発言の均等度: 話者別発話時間・ターン数の分布（Woolley et al. 2010）。
- 先行事例の発見率: 議論中に再発明しかけた案のうち、既存事例が提示・認知された割合。
- 過信と依存: AI が誤ったカードを出した際の採用率（Buçinca et al. 2021; Chiang et al. 2024）。
- 主観指標: 認知負荷、満足度、心理的安全性、会話の流れの阻害感（Chen, Tankelevitch et al. 2025; Lee et al. 2025）。
- 会議後の想起・理解: 決定事項と根拠の再生（Sparrow et al. 2011 の懸念の検証）。

### 5.6 先行システム（直接の比較対象）
- 会議中のジャストインタイム文書検索: AMIDA Automatic Content Linking Device（音声認識結果からクエリを作り、会議の記録・文書・Web ページをジャストインタイムに提示; Popescu-Belis et al. 2008, 2010）、Remembrance Agent ほかの JITIR エージェント（従来の検索エンジンより多くの情報を取得・利用; Rhodes & Maes 2000）。
- 会話へのプロアクティブ検索: 会話のエンティティを検出して情報を提示し、明示的検索の必要を減らしたが、会話の話題構造にも影響した（12 ペア; Andolina et al. 2018）。
- 音声議論の可視化: IdeaWall（口頭議論から要点を抽出し、Web 検索素材で補強して視覚刺激を提示; 12 グループ; Shi et al. 2017）、TalkTraces（トピックとアジェンダ関連度のリアルタイム可視化; Chandrasegaran et al. 2019）、Ideation Compass（話題のライブ可視化が自己省察と均衡のとれた議論を支援; Välk et al. 2022）、MeetMap（LLM によるリアルタイム対話マップ; Chen, Yap et al. 2025）。
- 参加の均等化: Second Messenger（発言参加の共有表示が参加量と情報共有過程に影響; DiMicco et al. 2007）、Meeting Mediator（ソシオメトリック・フィードバックで発話の重なりと支配者・非支配者の行動差が縮小; Kim et al. 2008）、GroupfeedBot（チャットでの均等な参加を促進; Kim et al. 2020）。
- LLM 時代の集団支援: LLM の DA（Chiang et al. 2024; Lee et al. 2025）、LLM ファシリテータ（情報共有↑・決定は不変; Alsobay et al. 2026）、Habermas Machine（5,734 人。AI 仲介の共通基盤文は人間の仲介者より好まれ、少数意見も取り込んだ; Tessler et al. 2024; ただし非同期テキストの熟議）、AI 強化ブレインライティング（Shaer et al. 2024）、会議 AI の「観察→質問→介入」（Houtti et al. 2025）、会議目標の振り返り（Chen, Tankelevitch et al. 2025）、生成 AI で会議フェーズを設計する CoExplorer（Park et al. 2024）、プロアクティブ・インイヤー助手 LlamaPIE（Chen, Batchelder et al. 2025）。
- ライブのファクトチェック: ClaimBuster（大統領選討論のライブでのクレーム検出; Hassan et al. 2017）、LiveFC（音声ストリームのライブファクトチェック; Venktesh & Setty 2024）。討論視聴時のファクトチェックは候補者評価を変えた（Wintersieck 2017）。即時訂正は条件付きで有効だが反発もある（Garrett & Weeks 2013）。
- 差別化の仮説: 先行システムは「検索提示」「可視化」「均等化」「DA」を個別に扱っている。本システムは、**先行事例の発見（L5）＋未出情報・異論の提示（L4）＋外部記憶としてのキャンバス（L1–L2）**を、パッシブ既定のタイミング政策のもとで統合する点が新規性の候補である（新規性の網羅的確認は未実施）。

### 5.7 リスクと対策
- AI 由来の同調・均質化（Jakesch et al. 2023; Doshi & Hauser 2024）→ 複数案と反証を常に併記し、結論を出さない既定にする。
- 幻覚・誤情報 → 出典のないカードは出さない、確信度を表示する、「不明」を許容する。
- 過信（Buçinca et al. 2021）→ 重要な決定前は「AI カードの根拠を一つ確認してください」型の軽い認知的強制を検討する（満足度とのトレードオフに注意）。
- 会話の主導権の侵食（Andolina et al. 2018 で話題構造が変化; Houde et al. 2025）→ 頻度上限とユーザー制御を設ける。
- 批判的フィードバックの無視（Houtti et al. 2025）→ 個人への指摘ではなく、集団全体への問いとして提示する。
- 情報過多によるさらなる認知負荷 → カード数の上限と、古いカードの自動折りたたみ。
- プライバシー・録音への抵抗 → 本ノートの範囲外（別途調査が必要）。

---

## 6. 未確認事項・限界
- 【未確認】EPO 由来とされる「R&D 支出の最大 30% が再発明で浪費」という数値（一次資料なし。出典と金額に揺れ）。
- 【二次】Asch の同調率（約 1/3、約 3/4）、Baltes et al. (2002) の結果と調整変数、Cao et al. (2021) の「会議の約 30%」、Chapanis らの「口頭は約 2 倍速い・4–5 倍の語数」、Schoenenberg et al. (2014) の評価低下、Whyte & Sebenius (1997) と de Wilde et al. (2018) の抄録、Valacich & Schwenk (1995) の結果、Schweiger et al. (1986/1989) の詳細、Janis の症状と対策の列挙、Esser (1998) の評価、Woolley et al. (2010) の「支配的な個人」の記述、DeRosa et al. (2007) の抄録、Yuan et al. (2006) の速度値、Mesmer-Magnus & DeChurch (2009) の「よく話す集団ほど独自情報が少ない」。
- 【未確認】Schwenk (1990) のメタ分析の効果量。Clark & Brennan (1991) の媒体×制約の表（Table 1）は本文 OCR から抽出できず、本文の記述で代替した。
- 本ノートは主に英語圏の実験室研究に基づく。日本語・日本の組織文化での効果量は未検証である（Bond & Smith 1996 から同調圧力が強い可能性は示唆される）。
- オフライン会議（ルームマイク 1 本）での話者分離精度、ASR の誤認識が検出トリガーに与える影響は本ノートの範囲外である。
- 「会議では少数の人が大半を話す」といった、出典の不明な俗説は採用していない。参加の不均等は Bales らの古典研究と Stephan & Mishler (1952) のモデル化があるが、規則性には異論もある（Kadane & Lewis 1969【二次】）ため、数値は引用しない。

---

## 7. 参考文献

### 7.1 メディア理論
- Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In L. B. Resnick, J. M. Levine, & S. D. Teasley (Eds.), *Perspectives on Socially Shared Cognition* (pp. 127–149). APA. https://doi.org/10.1037/10096-006
- Daft, R. L., & Lengel, R. H. (1986). Organizational information requirements, media richness and structural design. *Management Science*, 32(5), 554–571. https://doi.org/10.1287/mnsc.32.5.554
- Daft, R. L., Lengel, R. H., & Treviño, L. K. (1987). Message equivocality, media selection, and manager performance: Implications for information systems. *MIS Quarterly*, 11(3), 355–365. https://doi.org/10.2307/248682
- Dennis, A. R., & Valacich, J. S. (1999). Rethinking media richness: Towards a theory of media synchronicity. *Proceedings of the 32nd Hawaii International Conference on System Sciences (HICSS-32)*. https://doi.org/10.1109/HICSS.1999.772701
- Dennis, A. R., Fuller, R. M., & Valacich, J. S. (2008). Media, tasks, and communication processes: A theory of media synchronicity. *MIS Quarterly*, 32(3), 575–600. https://doi.org/10.2307/25148857
- Kock, N. (2004). The psychobiological model: Towards a new theory of computer-mediated communication based on Darwinian evolution. *Organization Science*, 15(3), 327–348. https://doi.org/10.1287/orsc.1040.0071

### 7.2 集団プロセス・ロス / 電子ブレスト
- Diehl, M., & Stroebe, W. (1987). Productivity loss in brainstorming groups: Toward the solution of a riddle. *Journal of Personality and Social Psychology*, 53(3), 497–509. https://doi.org/10.1037/0022-3514.53.3.497
- Diehl, M., & Stroebe, W. (1991). Productivity loss in idea-generating groups: Tracking down the blocking effect. *Journal of Personality and Social Psychology*, 61(3), 392–403. https://doi.org/10.1037/0022-3514.61.3.392
- Mullen, B., Johnson, C., & Salas, E. (1991). Productivity loss in brainstorming groups: A meta-analytic integration. *Basic and Applied Social Psychology*, 12(1), 3–23. https://doi.org/10.1207/s15324834basp1201_1
- Karau, S. J., & Williams, K. D. (1993). Social loafing: A meta-analytic review and theoretical integration. *Journal of Personality and Social Psychology*, 65(4), 681–706. https://doi.org/10.1037/0022-3514.65.4.681
- Nijstad, B. A., & Stroebe, W. (2006). How the group affects the mind: A cognitive model of idea generation in groups. *Personality and Social Psychology Review*, 10(3), 186–213. https://doi.org/10.1207/s15327957pspr1003_1
- Gallupe, R. B., Dennis, A. R., Cooper, W. H., Valacich, J. S., Bastianutti, L. M., & Nunamaker, J. F. (1992). Electronic brainstorming and group size. *Academy of Management Journal*, 35(2), 350–369. https://doi.org/10.2307/256377
- Dennis, A. R., & Valacich, J. S. (1993). Computer brainstorms: More heads are better than one. *Journal of Applied Psychology*, 78(4), 531–537. https://doi.org/10.1037/0021-9010.78.4.531
- DeRosa, D. M., Smith, C. L., & Hantula, D. A. (2007). The medium matters: Mining the long-promised merit of group interaction in creative idea generation tasks in a meta-analysis of the electronic group brainstorming literature. *Computers in Human Behavior*, 23(3), 1549–1581. https://doi.org/10.1016/j.chb.2005.07.003
- Edmondson, A. C. (1999). Psychological safety and learning behavior in work teams. *Administrative Science Quarterly*, 44(2), 350–383. https://doi.org/10.2307/2666999
- Kerr, N. L., & Tindale, R. S. (2004). Group performance and decision making. *Annual Review of Psychology*, 55, 623–655. https://doi.org/10.1146/annurev.psych.55.090902.142009

### 7.3 情報プーリング / 隠れたプロファイル / 媒体比較
- Stasser, G., & Titus, W. (1985). Pooling of unshared information in group decision making: Biased information sampling during discussion. *Journal of Personality and Social Psychology*, 48(6), 1467–1478. https://doi.org/10.1037/0022-3514.48.6.1467
- Stasser, G., & Titus, W. (1987). Effects of information load and percentage of shared information on the dissemination of unshared information during group discussion. *Journal of Personality and Social Psychology*, 53(1), 81–93. https://doi.org/10.1037/0022-3514.53.1.81
- Gigone, D., & Hastie, R. (1993). The common knowledge effect: Information sharing and group judgment. *Journal of Personality and Social Psychology*, 65(5), 959–974. https://doi.org/10.1037/0022-3514.65.5.959
- Lu, L., Yuan, Y. C., & McLeod, P. L. (2012). Twenty-five years of hidden profiles in group decision making: A meta-analysis. *Personality and Social Psychology Review*, 16(1), 54–75. https://doi.org/10.1177/1088868311417243
- Mesmer-Magnus, J. R., & DeChurch, L. A. (2009). Information sharing and team performance: A meta-analysis. *Journal of Applied Psychology*, 94(2), 535–546. https://doi.org/10.1037/a0013773
- Mesmer-Magnus, J. R., DeChurch, L. A., Jimenez-Rodriguez, M., Wildman, J., & Shuffler, M. (2011). A meta-analytic investigation of virtuality and information sharing in teams. *Organizational Behavior and Human Decision Processes*, 115(2), 214–225. https://doi.org/10.1016/j.obhdp.2011.03.002
- Schulz-Hardt, S., Brodbeck, F. C., Mojzisch, A., Kerschreiter, R., & Frey, D. (2006). Group decision making in hidden profile situations: Dissent as a facilitator for decision quality. *Journal of Personality and Social Psychology*, 91(6), 1080–1093. https://doi.org/10.1037/0022-3514.91.6.1080
- Mojzisch, A., & Schulz-Hardt, S. (2010). Knowing others' preferences degrades the quality of group decisions. *Journal of Personality and Social Psychology*, 98(5), 794–808. https://doi.org/10.1037/a0017627
- Dennis, A. R. (1996). Information exchange and use in group decision making: You can lead a group to information, but you can't make it think. *MIS Quarterly*, 20(4), 433–457. https://doi.org/10.2307/249563
- Hollingshead, A. B. (1996). Information suppression and status persistence in group decision making: The effects of communication media. *Human Communication Research*, 23(2), 193–219. https://doi.org/10.1111/j.1468-2958.1996.tb00392.x
- Lam, S. S. K., & Schaubroeck, J. (2000). Improving group decisions by better pooling information: A comparative advantage of group decision support systems. *Journal of Applied Psychology*, 85(4), 565–573. https://doi.org/10.1037/0021-9010.85.4.565
- Baltes, B. B., Dickson, M. W., Sherman, M. P., Bauer, C. C., & LaGanke, J. S. (2002). Computer-mediated communication and group decision making: A meta-analysis. *Organizational Behavior and Human Decision Processes*, 87(1), 156–179. https://doi.org/10.1006/obhd.2001.2961
- Dubrovsky, V. J., Kiesler, S., & Sethna, B. N. (1991). The equalization phenomenon: Status effects in computer-mediated and face-to-face decision-making groups. *Human-Computer Interaction*, 6(2), 119–146. https://doi.org/10.1207/s15327051hci0602_2

### 7.4 同調・集団浅慮・アンカー・異論
- Asch, S. E. (1956). Studies of independence and conformity: I. A minority of one against a unanimous majority. *Psychological Monographs*, 70(9), 1–70. https://doi.org/10.1037/h0093718
- Bond, R., & Smith, P. B. (1996). Culture and conformity: A meta-analysis of studies using Asch's (1952b, 1956) line judgment task. *Psychological Bulletin*, 119(1), 111–137. https://doi.org/10.1037/0033-2909.119.1.111
- Janis, I. L. (1972). *Victims of Groupthink: A Psychological Study of Foreign-Policy Decisions and Fiascoes*. Houghton Mifflin.（書評記録 https://doi.org/10.2307/1917768 で書誌を確認）
- Esser, J. K. (1998). Alive and well after 25 years: A review of groupthink research. *Organizational Behavior and Human Decision Processes*, 73(2–3), 116–141. https://doi.org/10.1006/obhd.1998.2758
- Myers, D. G., & Lamm, H. (1976). The group polarization phenomenon. *Psychological Bulletin*, 83(4), 602–627. https://doi.org/10.1037/0033-2909.83.4.602
- Tversky, A., & Kahneman, D. (1974). Judgment under uncertainty: Heuristics and biases. *Science*, 185(4157), 1124–1131. https://doi.org/10.1126/science.185.4157.1124
- Whyte, G., & Sebenius, J. K. (1997). The effect of multiple anchors on anchoring in individual and group judgment. *Organizational Behavior and Human Decision Processes*, 69(1), 75–85. https://doi.org/10.1006/obhd.1996.2674
- de Wilde, T. R. W., ten Velden, F. S., & De Dreu, C. K. W. (2018). The anchoring-bias in groups. *Journal of Experimental Social Psychology*, 76, 116–126. https://doi.org/10.1016/j.jesp.2018.02.001
- Schweiger, D. M., Sandberg, W. R., & Ragan, J. W. (1986). Group approaches for improving strategic decision making: A comparative analysis of dialectical inquiry, devil's advocacy, and consensus. *Academy of Management Journal*, 29(1), 51–71. https://doi.org/10.2307/255859
- Schweiger, D. M., Sandberg, W. R., & Rechner, P. L. (1989). Experiential effects of dialectical inquiry, devil's advocacy, and consensus approaches to strategic decision making. *Academy of Management Journal*, 32(4), 745–772. https://doi.org/10.2307/256567
- Schwenk, C. R. (1990). Effects of devil's advocacy and dialectical inquiry on decision making: A meta-analysis. *Organizational Behavior and Human Decision Processes*, 47(1), 161–176. https://doi.org/10.1016/0749-5978(90)90051-A
- Valacich, J. S., & Schwenk, C. R. (1995). Devil's advocacy and dialectical inquiry effects on face-to-face and computer-mediated group decision making. *Organizational Behavior and Human Decision Processes*, 63(2), 158–173. https://doi.org/10.1006/obhd.1995.1070
- Nemeth, C., Brown, K., & Rogers, J. (2001). Devil's advocate versus authentic dissent: Stimulating quantity and quality. *European Journal of Social Psychology*, 31(6), 707–720. https://doi.org/10.1002/ejsp.58
- Woolley, A. W., Chabris, C. F., Pentland, A., Hashmi, N., & Malone, T. W. (2010). Evidence for a collective intelligence factor in the performance of human groups. *Science*, 330(6004), 686–688. https://doi.org/10.1126/science.1193147
- Karpowitz, C. F., Mendelberg, T., & Shaker, L. (2012). Gender inequality in deliberative participation. *American Political Science Review*, 106(3), 533–547. https://doi.org/10.1017/S0003055412000329
- Stephan, F. F., & Mishler, E. G. (1952). The distribution of participation in small groups: An exponential approximation. *American Sociological Review*, 17(5), 598–608. https://doi.org/10.2307/2088227

### 7.5 聴取の認知・マルチタスク・ビデオ会議
- Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental storage capacity. *Behavioral and Brain Sciences*, 24(1), 87–114. https://doi.org/10.1017/S0140525X01003922
- Leahy, W., & Sweller, J. (2011). Cognitive load theory, modality of presentation and the transient information effect. *Applied Cognitive Psychology*, 25(6), 943–951. https://doi.org/10.1002/acp.1787
- Wong, A., Leahy, W., Marcus, N., & Sweller, J. (2012). Cognitive load theory, the transient information effect and e-learning. *Learning and Instruction*, 22(6), 449–457. https://doi.org/10.1016/j.learninstruc.2012.05.004
- Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. *Journal of Memory and Language*, 109, 104047. https://doi.org/10.1016/j.jml.2019.104047
- Yuan, J., Liberman, M., & Cieri, C. (2006). Towards an integrated understanding of speaking rate in conversation. *Proceedings of Interspeech 2006 (ICSLP)*, 541–544. https://www.isca-archive.org/interspeech_2006/yuan06_interspeech.html
- Piolat, A., Olive, T., & Kellogg, R. T. (2005). Cognitive effort during note taking. *Applied Cognitive Psychology*, 19(3), 291–312. https://doi.org/10.1002/acp.1086
- Monsell, S. (2003). Task switching. *Trends in Cognitive Sciences*, 7(3), 134–140. https://doi.org/10.1016/S1364-6613(03)00028-7
- Cao, H., Lee, C.-J., Iqbal, S., Czerwinski, M., Wong, P. N. Y., Rintel, S., Hecht, B., Teevan, J., et al. (2021). Large scale analysis of multitasking behavior during remote meetings. *CHI 2021*, 1–13. https://doi.org/10.1145/3411764.3445243
- Porcheron, M., Fischer, J. E., & Sharples, S. (2016). Using mobile phones in pub talk. *CSCW 2016*, 1649–1661. https://doi.org/10.1145/2818048.2820014
- Sparrow, B., Liu, J., & Wegner, D. M. (2011). Google effects on memory: Cognitive consequences of having information at our fingertips. *Science*, 333(6043), 776–778. https://doi.org/10.1126/science.1207745
- Bailenson, J. N. (2021). Nonverbal overload: A theoretical argument for the causes of Zoom fatigue. *Technology, Mind, and Behavior*, 2(1). https://doi.org/10.1037/tmb0000030
- Fauville, G., Luo, M., Queiroz, A. C. M., Bailenson, J. N., & Hancock, J. (2021). Zoom Exhaustion & Fatigue Scale. *Computers in Human Behavior Reports*, 4, 100119. https://doi.org/10.1016/j.chbr.2021.100119
- Fauville, G., Luo, M., Queiroz, A. C. M., Lee, A., Bailenson, J. N., & Hancock, J. (2023). Video-conferencing usage dynamics and nonverbal mechanisms exacerbate Zoom Fatigue, particularly for women. *Computers in Human Behavior Reports*, 10, 100271. https://doi.org/10.1016/j.chbr.2023.100271
- Boland, J. E., Fonseca, P., Mermelstein, I., & Williamson, M. (2022). Zoom disrupts the rhythm of conversation. *Journal of Experimental Psychology: General*, 151(6), 1272–1282. https://doi.org/10.1037/xge0001150
- Schoenenberg, K., Raake, A., & Koeppe, J. (2014). Why are you so slow? – Misattribution of transmission delay to attributes of the conversation partner at the far-end. *International Journal of Human-Computer Studies*, 72(5), 477–487. https://doi.org/10.1016/j.ijhcs.2014.02.004
- Brucks, M. S., & Levav, J. (2022). Virtual communication curbs creative idea generation. *Nature*, 605(7908), 108–112. https://doi.org/10.1038/s41586-022-04643-y

### 7.6 車輪の再発明 / NIH / 研究の浪費
- Katz, R., & Allen, T. J. (1982). Investigating the Not Invented Here (NIH) syndrome: A look at the performance, tenure, and communication patterns of 50 R&D project groups. *R&D Management*, 12(1), 7–20. https://doi.org/10.1111/j.1467-9310.1982.tb00478.x
- Antons, D., & Piller, F. T. (2015). Opening the black box of "Not Invented Here": Attitudes, decision biases, and behavioral consequences. *Academy of Management Perspectives*, 29(2), 193–217. https://doi.org/10.5465/amp.2013.0091
- Hansen, M. T. (1999). The search-transfer problem: The role of weak ties in sharing knowledge across organization subunits. *Administrative Science Quarterly*, 44(1), 82–111. https://doi.org/10.2307/2667032
- Robinson, K. A., & Goodman, S. N. (2011). A systematic examination of the citation of prior research in reports of randomized, controlled trials. *Annals of Internal Medicine*, 154(1), 50–55. https://doi.org/10.7326/0003-4819-154-1-201101040-00007
- Chalmers, I., & Glasziou, P. (2009). Avoidable waste in the production and reporting of research evidence. *The Lancet*, 374(9683), 86–89. https://doi.org/10.1016/S0140-6736(09)60329-9
- McKinsey Global Institute (2012). *The social economy: Unlocking value and productivity through social technologies*. https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-social-economy （業界レポート）

### 7.7 音声の強み・信頼
- Ochsman, R. B., & Chapanis, A. (1974). The effects of 10 communication modes on the behavior of teams during co-operative problem-solving. *International Journal of Man-Machine Studies*, 6(5), 579–619. https://doi.org/10.1016/S0020-7373(74)80019-2
- Bos, N., Olson, J., Gergle, D., Olson, G., & Wright, Z. (2002). Effects of four computer-mediated communications channels on trust development. *CHI 2002*, 135–140. https://doi.org/10.1145/503376.503401
- Rocco, E. (1998). Trust breaks down in electronic contexts but can be repaired by some initial face-to-face contact. *CHI 1998*, 496–502. https://doi.org/10.1145/274644.274711
- Kruger, J., Epley, N., Parker, J., & Ng, Z.-W. (2005). Egocentrism over e-mail: Can we communicate as well as we think? *Journal of Personality and Social Psychology*, 89(6), 925–936. https://doi.org/10.1037/0022-3514.89.6.925
- Schroeder, J., & Epley, N. (2015). The sound of intellect: Speech reveals a thoughtful mind, increasing a job candidate's appeal. *Psychological Science*, 26(6), 877–891. https://doi.org/10.1177/0956797615572906
- Schroeder, J., Kardas, M., & Epley, N. (2017). The humanizing voice: Speech reveals, and text conceals, a more thoughtful mind in the midst of disagreement. *Psychological Science*, 28(12), 1745–1762. https://doi.org/10.1177/0956797617713798
- Kumar, A., & Epley, N. (2021). It's surprisingly nice to hear you: Misunderstanding the impact of communication media can lead to suboptimal choices of how to connect with others. *Journal of Experimental Psychology: General*, 150(3), 595–607. https://doi.org/10.1037/xge0000962

### 7.8 リアルタイム情報支援・会議支援・LLM による集団支援
- Rhodes, B. J., & Maes, P. (2000). Just-in-time information retrieval agents. *IBM Systems Journal*, 39(3.4), 685–704. https://doi.org/10.1147/sj.393.0685
- Popescu-Belis, A., Boertjes, E., Kilgour, J., Poller, P., Castronovo, S., Wilson, T., Jaimes, A., & Carletta, J. (2008). The AMIDA Automatic Content Linking Device: Just-in-time document retrieval in meetings. *MLMI 2008, LNCS*, 272–283. https://doi.org/10.1007/978-3-540-85853-9_25
- Popescu-Belis, A., Kilgour, J., Nanchen, A., & Poller, P. (2010). The ACLD: Speech-based just-in-time retrieval of meeting transcripts, documents and websites. *Proceedings of the 2010 International Workshop on Searching Spontaneous Conversational Speech (SSCS '10)*, 45–48. https://doi.org/10.1145/1878101.1878111
- Andolina, S., Orso, V., Schneider, H., Klouche, K., Ruotsalo, T., Gamberini, L., & Jacucci, G. (2018). Investigating proactive search support in conversations. *DIS 2018*, 1295–1307. https://doi.org/10.1145/3196709.3196734
- Shi, Y., Wang, Y., Qi, Y., Chen, J., Xu, X., & Ma, K.-L. (2017). IdeaWall: Improving creative collaboration through combinatorial visual stimuli. *CSCW 2017*, 594–603. https://doi.org/10.1145/2998181.2998208
- Chandrasegaran, S., Bryan, C., Shidara, H., Chuang, T.-Y., & Ma, K.-L. (2019). TalkTraces: Real-time capture and visualization of verbal content in meetings. *CHI 2019*, 1–14. https://doi.org/10.1145/3290605.3300807
- Välk, S., Thabsuwan, C., & Mougenot, C. (2022, online). The Ideation Compass: Supporting interdisciplinary creative dialogues with real time visualization. *International Journal of Design Creativity and Innovation*, 11(2), 99–116. https://doi.org/10.1080/21650349.2022.2142674
- Chen, X., Yap, N., Lu, X., Gunal, A. E., & Wang, X. (2025). MeetMap: Real-time collaborative dialogue mapping with LLMs in online meetings. *Proceedings of the ACM on Human-Computer Interaction*, 9(2) (CSCW). https://doi.org/10.1145/3711030
- DiMicco, J. M., Hollenbach, K. J., Pandolfo, A., & Bender, W. (2007). The impact of increased awareness while face-to-face. *Human-Computer Interaction*, 22(1), 47–96. https://doi.org/10.1080/07370020701307781
- Kim, T., Chang, A., Holland, L., & Pentland, A. (2008). Meeting mediator: Enhancing group collaboration using sociometric feedback. *CSCW 2008*, 457–466. https://doi.org/10.1145/1460563.1460636
- Kim, S., Eun, J., Oh, C., Suh, B., & Lee, J. (2020). Bot in the bunch: Facilitating group chat discussion by improving efficiency and participation with a chatbot. *CHI 2020*, 1–13. https://doi.org/10.1145/3313831.3376785
- Hassan, N., Arslan, F., Li, C., & Tremayne, M. (2017). Toward automated fact-checking: Detecting check-worthy factual claims by ClaimBuster. *KDD 2017*, 1803–1812. https://doi.org/10.1145/3097983.3098131
- Venktesh, V., & Setty, V. (2024). LiveFC: A system for live fact-checking of audio streams. *arXiv:2408.07448*. https://doi.org/10.48550/arXiv.2408.07448
- Garrett, R. K., & Weeks, B. E. (2013). The promise and peril of real-time corrections to political misperceptions. *CSCW 2013*, 1047–1058. https://doi.org/10.1145/2441776.2441895
- Wintersieck, A. (2017). Debating the truth: The impact of fact-checking during electoral debates. *American Politics Research*, 45(2), 304–331. https://doi.org/10.1177/1532673X16686555
- Chiang, C.-W., Lu, Z., Li, Z., & Yin, M. (2024). Enhancing AI-assisted group decision making through LLM-powered devil's advocate. *IUI 2024*, 103–119. https://doi.org/10.1145/3640543.3645199
- Lee, S., Hwang, S., Kim, D., & Lee, K. (2025). Conversational agents as catalysts for critical thinking: Challenging social influence in group decision-making. *CHI 2025 Extended Abstracts (Late-Breaking Work)*. https://doi.org/10.1145/3706599.3719792
- Alsobay, M., Rothschild, D. M., Hofman, J. M., & Goldstein, D. G. (2026). Bringing everyone to the table: An experimental study of LLM-facilitated group decision making. *Proceedings of the ACM on Human-Computer Interaction*, 10(6) (CSCW 2026). https://doi.org/10.1145/3816907 （arXiv:2508.08242）
- Tessler, M. H., Bakker, M. A., Jarrett, D., Sheahan, H., Chadwick, M. J., Koster, R., Evans, G., Campbell-Gillingham, L., et al. (2024). AI can help humans find common ground in democratic deliberation. *Science*, 386(6719), eadq2852. https://doi.org/10.1126/science.adq2852
- Shaer, O., Cooper, A., Mokryn, O., Kun, A. L., & Ben Shoshan, H. (2024). AI-augmented brainwriting: Investigating the use of LLMs in group ideation. *CHI 2024*, 1–17. https://doi.org/10.1145/3613904.3642414
- Liu, X., Fang, S., Shi, W., Wu, C.-S., Igarashi, T., & Chen, X. (2025). Proactive conversational agents with inner thoughts. *CHI 2025*, 1–19. https://doi.org/10.1145/3706598.3713760
- Houde, S., Brimijoin, K., Muller, M. J., Ross, S., Moran, D., Gonzalez, G. E., Kunde, S., Foreman, M. A., et al. (2025). Controlling AI agent participation in group conversations: A human-centered approach. *IUI 2025*, 390–408. https://doi.org/10.1145/3708359.3712089
- Houtti, M., Zhou, M., Terveen, L., & Chancellor, S. (2025). Observe, ask, intervene: Designing AI agents for more inclusive meetings. *CHI 2025*, 1–18. https://doi.org/10.1145/3706598.3713838
- Chen, X., Tankelevitch, L., Vanukuru, R., Scott, A. E., Panda, P., & Rintel, S. (2025). Are we on track? AI-assisted active and passive goal reflection during meetings. *CHI 2025*, 1–22. https://doi.org/10.1145/3706598.3714052
- Park, G. W., Panda, P., Tankelevitch, L., & Rintel, S. (2024). The CoExplorer technology probe: A generative AI-powered adaptive interface to support intentionality in planning and running video meetings. *DIS 2024*, 1638–1657. https://doi.org/10.1145/3643834.3661507
- Chen, T., Batchelder, N. S., Liu, A., Smith, N. A., & Gollakota, S. (2025). LlamaPIE: Proactive in-ear conversation assistants. *Findings of ACL 2025*, 13801–13824. https://doi.org/10.18653/v1/2025.findings-acl.710
- Jakesch, M., Bhat, A., Buschek, D., Zalmanson, L., & Naaman, M. (2023). Co-writing with opinionated language models affects users' views. *CHI 2023*, 1–15. https://doi.org/10.1145/3544548.3581196
- Doshi, A. R., & Hauser, O. P. (2024). Generative AI enhances individual creativity but reduces the collective diversity of novel content. *Science Advances*, 10(28), eadn5290. https://doi.org/10.1126/sciadv.adn5290
- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). To trust or to think: Cognitive forcing functions can reduce overreliance on AI in AI-assisted decision-making. *Proceedings of the ACM on Human-Computer Interaction*, 5(CSCW1), 1–21. https://doi.org/10.1145/3449287
- Adamczyk, P. D., & Bailey, B. P. (2004). If not now, when? The effects of interruption at different moments within task execution. *CHI 2004*, 271–278. https://doi.org/10.1145/985692.985727
- Iqbal, S. T., & Bailey, B. P. (2008). Effects of intelligent notification management on users and their tasks. *CHI 2008*, 93–102. https://doi.org/10.1145/1357054.1357070

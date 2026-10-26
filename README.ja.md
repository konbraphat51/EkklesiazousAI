# EkklesiazousAI

Ἐκκλησιάζουσαι (Ekklesiazousai) = 民会 (ἐκκλησία) に忍び込む者

[English](README.md)

## これは何か

EkklesiazousAI は、会議 (部屋のマイク 1 本で行う対面会議、または Google Meet / Zoom / Teams のオンライン会議) を日本語・英語・その混在で聞き取り、話題にのぼったことを AI がその場で静かに調べます。結果は数秒で、参加者がそれぞれの端末で開く Miro のような無限キャンバスに共有されます。

音声の議論は、誰かが調べ物をする前に先へ進んでしまいます。その結果、車輪の再発明、すれ違い、早すぎる合意が起こります。エージェントはこれを補います。

- **既存事例** — 誰かが「作ろう」と言うと、既存の製品・論文・手法を提示します。
- **補足** — 知らない人がいそうな用語・論文・事例を解説し、共有の用語集にまとめます。
- **根拠** — 事実の主張や議論を引きずる数値を、出典にあたって確認します。
- **問いかけ** — 議論が性急にまとまりかけると、根拠に基づく問いを投げかけます (悪魔の代弁者)。
- **論点マップ** — 問い・案・賛否・決定を IBIS 形式で整理し、要約を更新し続けます。
- **こっそり解説** — 文字起こしの行をクリック (または `?` キー) すると、あなたにだけ解説が出ます。複数人が同じ箇所で困ると、匿名の補足カードが全員に出ます。
- **匿名の問題提起** — 言いにくい懸念を入力すると、AI が自分の意見として提起します。
- **明示的な調査依頼** — 入力するか「エクレシア、〜を調べて」と話しかけます。調査の深さ (さっと / 標準 / じっくり) を選べます。

カードはまず平易な一文だけを表示し、詳細や深掘りは誰かが開いたときにだけ生成します。提示方法は仮説ごとに切り替えられ (タイムライン、話題の島、論点マップ、静かな周辺表示、共有スポットライト、表示タイミングなど)、UX 研究のために操作ログを記録します。

## セットアップ (初回)

必要なもの: Node.js 22 以上、pnpm 10。

```bash
git clone https://github.com/konbraphat51/EkklesiazousAI.git
cd EkklesiazousAI
pnpm install
cp .env.example .env   # 任意: API キーを設定 (キーがなくてもデモモードで動きます)
pnpm dev
```

http://localhost:5173 を開き **Start demo meeting** (デモ会議を開始) を押すと、日英混在のスクリプト会議がモック AI で動きます。キーは不要です。

実際の会議で使うには、`.env` に少なくとも `SONIOX_API_KEY` (音声認識) と `ANTHROPIC_API_KEY` (AI) を設定してください。検索キー (`PARALLEL_API_KEY`、`EXA_API_KEY`) を加えると結果が良くなります。詳しくは [Docs/Providers.ja.md](Docs/Providers.ja.md) を参照してください。

## 2 回目以降の起動

```bash
pnpm dev                 # 開発: サーバー :8787、クライアント :5173 (ホットリロード)
```

本番用に 1 つのサーバーで動かす場合:

```bash
pnpm build
pnpm start               # ビルド済みクライアントと API を http://localhost:8787 で配信
```

他の端末の参加者は同じルームの URL を開きます (`HOST=0.0.0.0` にしてこの PC のアドレスを使うか、オンライン会議では ngrok などのトンネルを使います)。

## 主なコマンド

| コマンド                    | 用途                                           |
| --------------------------- | ---------------------------------------------- |
| `pnpm dev`                  | サーバーとクライアントをホットリロードで起動   |
| `pnpm demo`                 | 同上。ただしキーがあってもモック AI を使う     |
| `pnpm build`                | 全体を型チェックし、クライアントをビルド       |
| `pnpm start`                | 本番サーバーを起動 (`Apps/Client/dist` を配信) |
| `pnpm test`                 | 単体・結合テストをすべて実行                   |
| `pnpm typecheck`            | 全パッケージを型チェック                       |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                              |

## ドキュメント

- [Docs/Architecture.ja.md](Docs/Architecture.ja.md) — 構成要素、データモデル、クラス図・シーケンス図、低遅延設計
- [Docs/UxHypotheses.ja.md](Docs/UxHypotheses.ja.md) — 提示バリアントとその仮説、実験の進め方
- [Docs/MeetingPlatforms.ja.md](Docs/MeetingPlatforms.ja.md) — 対面・Google Meet・Zoom・Teams の音声取り込みと設定
- [Docs/Providers.ja.md](Docs/Providers.ja.md) — 音声認識・言語モデル・検索のプロバイダと設定
- [ResearchNotes/](ResearchNotes/) — 設計の根拠となった調査メモ

## ディレクトリ構成

```
Apps/Server      Node.js サーバー: 音声取り込み、音声認識、エージェント処理、Yjs 同期ハブ
Apps/Client      Vue 3 クライアント: 無限キャンバス、文字起こし、こっそり解説、設定
Packages/Shared  両者が共有するドメインモデル、Yjs ボードのスキーマ、通信プロトコル
Docs             システムドキュメント (英語 + 日本語)
ResearchNotes    調査メモ
```

## ライセンス

MIT

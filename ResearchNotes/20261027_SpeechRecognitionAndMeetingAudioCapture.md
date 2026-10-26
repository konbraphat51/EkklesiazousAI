# リアルタイム音声認識 API と会議音声キャプチャ調査 (2026-10-27)

EkklesiazousAI (会議をリアルタイムに聞き、共有キャンバスへ情報を提示する AI エージェント) のための調査メモ。
対象は (A) 対面会議 (部屋に 1 台のノート PC マイク、リアルタイム話者分離が必要)、(B) Zoom 会議 (できれば参加者ごとの音声と名前)。
言語は日本語と英語、および同一会議内・同一文内の混在 (コードスイッチング)。最優先は両言語の精度と低遅延 (部分結果 300〜500 ms 以内)。

- 調査日: 2026-10-27。Web 上の公式ドキュメントを優先して確認した。
- 「未確認」= 公式一次資料で確認できなかった項目。「要確認」= 資料間で矛盾がある、または二次情報のみの項目。
- 価格は従量課金 (PAYG) の公開価格。プロモ価格や地域差があるので、契約前に必ず再確認すること。

---

## 0. 結論 (TL;DR)

| 区分 | 推奨 | 理由 |
| --- | --- | --- |
| **ASR デフォルト** | **Soniox `stt-rt-v5`** (WebSocket 直叩き) | 日英を含む 60+ 言語を 1 モデルで処理。トークン単位で `language` を返す言語識別、リアルタイム話者分離 (最大 15 人)、最大 8,000 トークンの文脈 (`context`) 指定に対応し、これらが約 $0.12/時 に込み。ブラウザ直結用の一時キーとサブプロトコル認証もある |
| **ASR フォールバック** | **AssemblyAI Universal-3.6 Pro Realtime (`universal-3-6-pro`)** | 日本語を含む 32 言語で、ネイティブのコードスイッチング、ストリーミング話者分離 (`speaker_labels`)、keyterms (100 語まで追加料金なし) に対応。P50 遅延は約 150 ms (VAD 後)。別ベンダーなので障害時の冗長化にもなる。$0.45/時 + 話者分離 $0.12/時 |
| 第 3 候補 | Deepgram Nova-3 (`language=multi`) | 日本語を含む多言語コードスイッチングとストリーミング話者分離に対応。ドキュメントと SDK が最も成熟している |
| **Zoom (本番)** | **Zoom RTMS** (Realtime Media Streams)。`AUDIO_MULTI_STREAMS` で参加者別音声 + `user_name` を取得 | 公式。ボットが参加しない。参加者別 PCM を 16 kHz mono で受信できる。ただし Developer Pack (有料クレジット)、Marketplace の General アプリ、ホストの承認または自動開始が必要 |
| Zoom (マネージド代替) | Recall.ai Meeting Bot (`audio_separate_raw.data`) | Zoom、Meet、Teams を横断できる。参加者別 16 kHz PCM と名前を WebSocket で受信。$0.50/時 |
| Zoom (MVP / 設定ゼロ) | ブラウザの `getDisplayMedia` (Zoom Web クライアントのタブ音声、または Windows のシステム音声) + 自分のマイク | 承認が不要ですぐ使える。ただし話者名は取れず、ASR 側の話者分離に頼る |

**注意 (重要)**: 日本語 CER の**独立した**ベンチマークは見つからなかった。ベンダーの日本語ページに出ている「日本語 WER 1.25%」などの数値は、英語の Pipecat ベンチマーク値と一致しており、日本語の実測値ではない可能性が高い (§1.3)。**自社の日英混在会議音声で CER と遅延を実測してから最終決定すること** (§5)。

---

## 1. リアルタイム STT API 比較

### 1.1 機能比較 (日本語・日英混在・話者分離)

| ベンダー / モデル | 日本語ストリーミング | 日英コードスイッチング (同一ストリーム内) | リアルタイム話者分離 | 部分結果 / 確定の仕組み | カスタム語彙・文脈 | ブラウザ直結 (一時キー) |
| --- | --- | --- | --- | --- | --- | --- |
| **Soniox `stt-rt-v5`** (2026-06-16 リリース。`stt-rt-v4` はエイリアスとして v5 に転送) | ○ (全言語でリアルタイム対応と明記) | ○ トークン単位で `language` を付与。`language_hints` と `language_hints_strict` あり。同一文内の切り替えの挙動は実測が必要 | ○ `enable_speaker_diarization`。最大 15 話者。トークンごとに `speaker` | トークンごとの `is_final`。非確定トークンは毎レスポンスで置き換わる。`<end>` (エンドポイント) と `<fin>` (手動 finalize) | `context`: `general` (key/value)、`text`、`terms`、`translation_terms`。合計 8,000 トークン (約 1 万文字) まで | ○ `POST /v1/auth/temporary-api-key` で一時キー (`snx_temp_` で始まる) を発行し、WebSocket サブプロトコルで渡す |
| **AssemblyAI `universal-3-6-pro`** | ○ (32 言語。Japanese を明記) | ○ "Native code-switching" | ○ `speaker_labels=true` (+$0.12/時)。Turn 単位の `speaker_label` (A/B…。短いターンは `PENDING`)。`max_speakers` は 1〜10。後から `SpeakerRevision` で修正が届く | `Turn` メッセージ (`end_of_turn`、`words[].word_is_final`) | `keyterms_prompt` (100 語まで、料金込み)、`prompt` (1,750 文字、+$0.05/時、ベータ) | ○ `GET /v3/token` で単回使用トークンを発行し、`?token=` で渡す |
| Deepgram Nova-3 (`language=multi`) | ○ | ○ コードスイッチング対応の 10 言語に `ja` を含む。`endpointing=100` が推奨 | ○ `diarize` / `diarize_model=latest` (ストリーミングは v1/latest のみ)。`words[].speaker` | `is_final`、`speech_final`、`UtteranceEnd` | `keyterm` (Nova-3) | △ サブプロトコル `token, <API_KEY>` は文書化されている。JWT (`/v1/auth/grant`) をブラウザの WebSocket で使う方法は**未確認** |
| Deepgram Flux Multilingual (`flux-general-multi`, 2026-04 GA) | ○ (10 言語に `ja`) | ○ 文の途中での切り替えに対応 | **未確認** (音声エージェント向けのターン検出モデル) | ターンイベント (400 ms 未満) | `language_hint` | 同上 |
| Speechmatics (Standard / Enhanced) | ○ (`ja`) | × 日英のバイリンガルパックはない (`cmn_en` などのみ)。多言語モデル Melia 1 はリアルタイムの提供状況が**要確認** (料金表には $0.40/時 とあるが、話者分離は Melia RT 非対応) | ○ (Enhanced/Standard は無料で付属) | `enable_partials` (通常 500 ms 未満)。`max_delay` は 0.7〜4 秒 | カスタム辞書あり | JWT あり (詳細は未確認) |
| Azure AI Speech (`ConversationTranscriber`) | ○ | △ 連続言語識別は候補 10 言語まで。ただし「同一文内の言語切り替えは非対応」と公式に明記 | ○ `SpeakerId` (`DiarizeIntermediateResults` で途中結果にも付与) | `Transcribing` / `Transcribed` イベント | フレーズリスト、カスタム音声モデル | ○ STS トークン (JS SDK `microsoft-cognitiveservices-speech-sdk` 1.53.0)。ConversationTranscriber と連続言語識別の併用は**未確認** |
| Google Chirp 3 (Speech-to-Text v2) | ○ (StreamingRecognize で `ja-JP` GA) | △ `language_codes=["auto"]` または候補を複数指定できる。文の途中での切り替えは**未確認** | **×** ストリーミングでは話者分離不可 (Batch/Recognize のみ) | 発話単位のタイムスタンプ。エンドポイント感度は STANDARD/SHORT/SUPERSHORT | 音声適応 (フレーズ 1,000 まで) | × (サーバー経由の gRPC が前提) |
| OpenAI `gpt-live-transcribe` (2026-07 リリース。二次情報) | ○ (`languages` ヒントあり。対応言語の一覧は**未確認**) | △ `languages` を複数指定できる。挙動は未確認 | **×** 話者ラベル、単語タイムスタンプ、信頼度はいずれもなし | `...transcription.delta` / `.completed`。サーバー VAD 非対応のため、クライアント側の VAD で `commit` する | `prompt`、`keywords` | ○ Realtime の client secret / WebRTC (詳細は本調査の対象外) |
| ElevenLabs `scribe_v2_realtime` | ○ (90+ 言語に日本語) | **未確認** | **×** (`diarize` パラメータなし。`speaker_id` は "if available") | `partial_transcript` / `committed_transcript` | keyterms は 50 語 (各 20 文字) まで | ○ 単回使用トークンを `?token=` で渡す |
| Gladia `solaria-1` | ○ (100+ 言語) | ○ `language_config.code_switching=true` (発話ごとに言語を再判定) | **×** (live init のスキーマに話者分離の項目がない) | 部分結果 (`receive_partial_transcripts`) | `custom_vocabulary` | ○ `POST /v2/live` が一時トークン付きの WSS URL を返す |
| Amazon Transcribe Streaming | ○ (`ja-JP`。カスタム言語モデルも対応) | △ ストリーミングの多言語識別 (`IdentifyMultipleLanguages`) が日本語に対応するかは**未確認** | ○ (`ShowSpeakerLabel`。日本語での可否は**未確認**) | 部分結果の安定化あり | カスタム語彙、カスタム言語モデル | △ SigV4 署名付き URL |

### 1.2 遅延と価格

| ベンダー / モデル | 遅延 (公称または第三者計測) | 価格 (1 時間あたり、PAYG) |
| --- | --- | --- |
| Soniox `stt-rt-v5` | Pipecat ベンチ (英語) の TTFS 中央値 260 ms。部分トークンの ms 値は公称なし (**実測が必要**) | **約 $0.12** (話者分離、言語識別、整形込み)。文脈や翻訳を使う場合はトークン課金 (入力音声 $2/1M、テキスト入出力 $4/1M) |
| AssemblyAI `universal-3-6-pro` | P50 約 150 ms、P90 約 240 ms (VAD 後)。確定ターンの P50 は約 250 ms (公式)。Pipecat ベンチの TTFS は 282 ms (3.5 Pro) | $0.45 + 話者分離 $0.12 = **$0.57** (+ prompt $0.05)。セッションの接続時間で課金 (アイドル時間も含む) |
| Deepgram Nova-3 multi | Pipecat ベンチの TTFS 247 ms | $0.0058/分 (= $0.35) + 話者分離 $0.0020/分 (= $0.12) = **約 $0.47** (期間限定のプロモ価格) |
| Speechmatics | 部分結果は通常 500 ms 未満。確定は `max_delay` が最小 0.7 秒 | Standard $0.45 / Enhanced $0.80 / Melia 1 $0.40 (話者分離は無料) |
| Azure | Pipecat ベンチの TTFS 1,016 ms | 約 $1.00 + 話者分離・連続言語識別が各 $0.30 (二次情報、**要確認**) |
| Google Chirp 3 | 未計測 | 約 $0.96 ($0.016/分。二次情報、**要確認**) |
| OpenAI `gpt-live-transcribe` | `delay` を minimal〜xhigh で指定 | 約 $1.02 ($0.017/分。二次情報、**要確認**) |
| ElevenLabs Scribe v2 RT | 約 150 ms (公称) | $0.39 |
| Gladia solaria-1 | 部分結果 103 ms、確定 270 ms (自社公称) | 約 $0.55 (二次情報、**要確認**) |
| Amazon Transcribe | Pipecat ベンチの TTFS 1,136 ms | **未確認** |

### 1.3 精度のエビデンス (日本語)

- **独立した日本語 CER ベンチマークは見つからなかった。**
- Soniox がホストしている Pipecat STT benchmark (2026-08、英語 1,000 サンプル、semantic WER、リアルタイム) の結果: Azure 1.21%、Soniox 1.34% (pooled 1.27%)、Speechmatics 1.40%、AssemblyAI 3.5 Pro 1.44%、AWS 1.68%、Deepgram Nova-3 1.71%、AssemblyAI u3-rt-pro 1.74%、Google gemini-3.5-transcribe-live 2.24%、OpenAI gpt-realtime-whisper 2.92%、ElevenLabs 3.16%、gpt-4o-transcribe 3.24%。**英語のみの結果。**
- 日本語の比較ブログや Soniox の「vs ElevenLabs (Japanese)」ページに出てくる「日本語 WER: Azure 1.21%、Soniox 1.25%、AWS 1.68%、Deepgram 1.71%…」は、上記の**英語の値とほぼ一致する**。日本語の測定値として扱ってはいけない。
- Soniox の 2025 年版 PDF ベンチマーク (日本語は CER、YouTube 音声 45〜70 分) は存在するようだが、URL が 404 で**未確認**。
- 結論: 日本語と日英混在の精度は、§5 の手順で**自社データを使って実測する必要がある**。

---

## 2. 推奨構成と実装詳細

### 2.0 アーキテクチャ方針

- 音声ソースはアダプタとして抽象化する: ブラウザマイク、ブラウザのタブ/システム音声、Zoom RTMS、Recall.ai。どのアダプタも共通の `AudioFrame` (PCM16 / 16 kHz / mono, `sourceId`, `participantName?`, `captureTimestamp`) を出す。
- ASR は `SpeechRecognitionSession` インターフェースの裏に Soniox 実装と AssemblyAI 実装を置き、DI で切り替える。出力は共通の `TranscriptEvent` (partial/final、text、speaker、language、startMs、endMs)。
- **ASR 接続はサーバー (Node.js) 側に置くことを推奨する。** エージェントはサーバーで動き、Zoom RTMS や Recall の音声もサーバーに届くので、統一できる。ブラウザからサーバーへの WebSocket 中継 1 段で増える遅延は小さい (同一リージョンなら数 ms〜数十 ms)。どうしても遅延を削りたい場合だけ、ブラウザから Soniox へ一時キーで直結する。
- Node.js v25 には標準の `WebSocket` がある。ただしヘッダー認証が要るなら `ws` (8.22.0) を使うのが確実。標準 `WebSocket` でカスタムヘッダーを設定できるかは**未確認**。Soniox はサブプロトコル認証にも対応しているので、標準 `WebSocket` でも接続できる。

### 2.1 デフォルト: Soniox `stt-rt-v5`

**SDK**: `@soniox/node` 2.4.0 (Node)、`@soniox/client` 2.4.0 (ブラウザ)。旧版の `@soniox/speech-to-text-web` 1.4.0 もある。
SDK は keepalive を自動で処理する (pause 中は 5,000 ms ごと) が、プロトコルが単純なので**生の WebSocket 実装を推奨する**。参加者別ストリームの多重管理、再接続、タイムスタンプ補正を自前で制御しやすいため。

#### 接続と認証

```text
URL:  wss://stt-rt.soniox.com/transcribe-websocket

Server (Node, ws):   header  Authorization: Bearer <SONIOX_API_KEY>
Browser:             new WebSocket(URL, ["soniox-api-key", "<snx_temp_... temporary key>"])
  - Use only one method (header OR protocols). Sending both returns a 400 error frame.
  - A bad key does NOT fail the handshake: onopen fires, then an error JSON arrives, then close.
  - "api_key" inside the start message is DEPRECATED; refused from 2027-01-15.
  - Legacy "temp:" style temporary keys are not accepted in the protocols list.
```

一時キーの発行 (サーバー側で行う):

```http
POST https://api.soniox.com/v1/auth/temporary-api-key
Authorization: Bearer <SONIOX_API_KEY>
Content-Type: application/json

{
  "usage_type": "transcribe_websocket",   // required
  "expires_in_seconds": 60,               // required; window to OPEN streams (SDK doc: 1..3600)
  "single_use": true,                     // optional
  "max_session_duration_seconds": 14400,  // optional; cap per stream
  "client_reference_id": "meeting-123"    // optional; appears in usage logs
}
```

レスポンスのフィールド名は公式ページに記載がない (**未確認**)。公式の direct-stream サンプルが `data.api_key` を読んでいるので、`api_key` を含むと推定される。

#### 開始メッセージ (最初のテキストフレーム、JSON)

```json
{
  "model": "stt-rt-v5",
  "audio_format": "pcm_s16le",
  "sample_rate": 16000,
  "num_channels": 1,
  "language_hints": ["ja", "en"],
  "language_hints_strict": false,
  "enable_language_identification": true,
  "enable_speaker_diarization": true,
  "enable_endpoint_detection": true,
  "max_endpoint_delay_ms": 1500,
  "endpoint_sensitivity": 0.3,
  "endpoint_latency_adjustment_level": 2,
  "context": {
    "general": [
      { "key": "domain", "value": "Product planning meeting" },
      { "key": "participants", "value": "Tanaka, Suzuki, John" }
    ],
    "text": "Agenda: Q4 roadmap, EkklesiazousAI canvas design ...",
    "terms": ["EkklesiazousAI", "Soniox", "RTMS", "Vue"]
  },
  "client_reference_id": "meeting-123"
}
```

- 必須は `model` と `audio_format`。raw PCM の場合は `sample_rate` と `num_channels` も必須。
- `audio_format` は `"auto"` (webm/ogg/wav/mp3 など) も使えるが、遅延の面では raw PCM を推奨。他に `pcm_f32le`、`mulaw`、`alaw` など。
- エンドポイント関連の 3 パラメータ (`endpoint_sensitivity`、`endpoint_latency_adjustment_level`) は v5 専用。上の値は公式が「低遅延向けの出発点」として挙げているもの。
- **トレードオフ**: 公式は「話者分離の精度を最優先するならエンドポイント検出を使わない」としている。会議の文字起こしではキャンバス表示用の区切りが欲しいので、まずは有効で試し、話者分離が崩れるなら無効にして手動 `finalize` に切り替える。
- `language_hints_strict: true` にすると出力がヒントの言語 (ja/en) に限定される。漢字の多い発話が中国語と誤判定されるなどの問題が出たら試す。
- `translation` (`one_way` / `two_way`) も同じ接続で使える (日英の相互翻訳。翻訳トークンは `translation_status` で区別される)。

#### 音声の送信

- **バイナリフレーム**で PCM s16le / 16 kHz / mono を送る。
- チャンクサイズについて公式の推奨値はない。公式サンプルは 3,840 bytes (= 120 ms) を 120 ms 間隔で送っている。本プロジェクトでは **40〜100 ms (1,280〜3,200 bytes)** を推奨する。
- 1 ストリームの上限は 300 分。それより長い会議では張り替えが必要。
- 空のバイナリフレームは「空の音声チャンク」として扱われ、ストリームは終了しない。

#### 制御メッセージ (テキストフレーム)

```json
{"type": "keepalive"}   // audio が流れていない間は 20 秒以内に必ず送る (推奨 5〜10 秒間隔)。
                        // start 前の保持は 40 秒ごと (無送信 40 秒で close 1001)。
{"type": "finalize"}    // 非確定トークンを即確定させる。完了時に {"text":"<fin>","is_final":true} が届く。
                        // 発話終了後 ~200 ms の無音で送るのが公式推奨。送りすぎると切断の恐れ。
""                      // 空テキストフレーム = 音声終了 (end-of-stream)
```

- 開始後に音声も keepalive も 20 秒届かないと、408 `request_timeout` で切断される。
- 課金は**ストリームの接続時間全体**が対象 (pause 中も含む)。

#### レスポンス

```json
{
  "tokens": [
    {"text": "今日", "start_ms": 600, "end_ms": 760, "confidence": 0.97,
     "is_final": true, "speaker": "1", "language": "ja"},
    {"text": " roadmap", "start_ms": 900, "end_ms": 1200, "confidence": 0.88,
     "is_final": false, "speaker": "2", "language": "en"}
  ],
  "final_audio_proc_ms": 760,
  "total_audio_proc_ms": 1200
}
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `tokens[].text` | string | トークン文字列 (サブワード。先頭にスペースが付くこともある)。特殊トークンは `<end>` (エンドポイント) と `<fin>` (finalize 完了) |
| `tokens[].start_ms` / `end_ms` | number? | ストリーム開始からの ms。翻訳トークンには付かない |
| `tokens[].confidence` | number | 0.0〜1.0 |
| `tokens[].is_final` | boolean | **確定トークンは 1 回だけ送られ、以後変わらない** |
| `tokens[].speaker` | string? | `"1"`、`"2"`…。話者分離が有効なとき |
| `tokens[].language` | string? | `"ja"` / `"en"`…。言語識別が有効なとき |
| `tokens[].translation_status` / `source_language` | string? | 翻訳を使うときだけ |
| `final_audio_proc_ms` / `total_audio_proc_ms` | number | 確定済みの音声位置と、非確定を含む処理済みの音声位置 |
| `finished` | boolean? | 最後のメッセージで `true`。この後サーバーが接続を閉じる |

- **蓄積のアルゴリズム**: `finalTokens.push(...is_final なもの)`。非確定トークンはレスポンスごとに**丸ごと置き換える**。表示テキストは `finalTokens + 現在の nonFinalTokens`。
- **エラー**: `{"error_code": 4xx|5xx, "error_type": "...", "error_message": "...", "more_info": "...", "request_id": "..."}` が届き、その後すぐ切断される。主な `error_type` は `unauthenticated` (401)、`organization_balance_exhausted` (402)、`temp_api_key_session_expired` (403)、`request_timeout` (408、無通信)、`max_duration_reached` (413)、`max_concurrent_connections_reached` (429)、`service_unavailable` (503。バックオフして再試行)。

#### メッセージシーケンスの例

```text
C→S  [WebSocket open]  (Authorization: Bearer ... | protocols ["soniox-api-key", key])
C→S  text   {"model":"stt-rt-v5","audio_format":"pcm_s16le","sample_rate":16000,"num_channels":1,...}
C→S  binary <3200 bytes PCM>   (every 100 ms)
S→C  text   {"tokens":[{"text":"今","is_final":false,"speaker":"1","language":"ja",...}],...}
C→S  binary <3200 bytes PCM>
S→C  text   {"tokens":[{"text":"今日","is_final":true,...},{"text":"は","is_final":false,...}],...}
...  (silence)
S→C  text   {"tokens":[{"text":"<end>","is_final":true}],...}        // endpoint detected
C→S  text   {"type":"keepalive"}                                       // if audio paused
C→S  text   ""                                                         // end of audio
S→C  text   {"tokens":[...remaining final...],...}
S→C  text   {"tokens":[],"final_audio_proc_ms":...,"total_audio_proc_ms":...,"finished":true}
S→C  [close]
```

#### 実装メモ

- 話者ラベル (`"1"` など) はセッション内でのみ有効。再接続するとリセットされるので、UI 側で「Speaker 1 = 田中」の対応付けを管理し、再接続時には引き継ぎ確認を出す。
- Zoom の参加者別ストリームを使う場合は、参加者ごとに 1 本の Soniox ストリームを張り、話者分離は OFF にして、参加者名を話者として扱う。$0.12/時 × 人数なので安い。話していない間は**ゼロ埋めの無音 PCM を送るか keepalive を送る**。タイムライン (`start_ms`) を実時間と揃えたいなら無音で埋めるほうが簡単 (課金は接続時間なので費用は変わらない)。

### 2.2 フォールバック: AssemblyAI Universal-3.6 Pro Realtime

**SDK**: `assemblyai` 4.41.7 (npm、Node とブラウザの両方)。プロトコルは単純なので、生の WebSocket 実装でも問題ない。

#### 接続と認証

```text
URL:  wss://streaming.assemblyai.com/v3/ws?<query>
      (US residency: wss://streaming.us.assemblyai.com/v3/ws, EU: wss://streaming.eu.assemblyai.com/v3/ws)

Server (Node, ws):   header  Authorization: <ASSEMBLYAI_API_KEY>      // NO "Bearer" prefix
Browser:             wss://streaming.assemblyai.com/v3/ws?token=<temp token>&...
```

一時トークン (単回使用。サーバー側で発行する):

```http
GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=10800
Authorization: <ASSEMBLYAI_API_KEY>

200 → {"token": "<temp token>", "expires_in_seconds": 60}
```

- `expires_in_seconds` (1〜600) は、トークンで接続を開始できる猶予時間。`max_session_duration_seconds` (60〜10800、既定 10800) はセッションの長さの上限。

#### 設定 (クエリパラメータ。開始メッセージはない)

```text
speech_model=universal-3-6-pro      (enum: universal-3-6-pro | universal-3-5-pro | universal-streaming-english | universal-streaming-multilingual)
encoding=pcm_s16le                  (pcm_s16le | pcm_mulaw | opus | ogg_opus | aac)
sample_rate=16000                   (8000..96000)
speaker_labels=true
max_speakers=6                      (1..10, optional)
language_detection=true
keyterms_prompt=<JSON array, URL-encoded>   e.g. ["EkklesiazousAI","RTMS"]  (max 100)
prompt=<text up to 1750 chars>      (optional, beta, +$0.05/h)
min_turn_silence=<ms>               (clamped 50..10000)
max_turn_silence=<ms>               (default 1536 on 3.5 Pro)
end_of_turn_confidence_threshold=0.4
```

- **要確認**: AssemblyAI の LLM 向けリファレンスには「`speech_models` (複数形) が正しく、`speech_model` は非推奨」との記述がある。一方 API リファレンスは `speech_model` を使っている。また、公式のクイックスタートには別名の `u3-rt-pro` も出てくる。
- **要確認**: クエリで渡す `keyterms_prompt` のエンコード形式 (JSON 配列文字列か、繰り返しパラメータか)。SDK を使うと吸収される。

#### 音声の送信

- バイナリフレームで PCM s16le 16 kHz mono を送る。**1 チャンクは 50〜1000 ms 分** (公式の要件)。推奨は 100 ms = 3,200 bytes。

#### 制御メッセージ (テキスト JSON)

```json
{"type": "KeepAlive"}
{"type": "ForceEndpoint"}          // 現在のターンを即確定
{"type": "UpdateConfiguration", "keyterms_prompt": ["..."], "prompt": "...", "min_turn_silence": 700, "max_turn_silence": 1600}
{"type": "Terminate"}              // end-of-stream。必ず送る (セッション時間課金のため)
```

- 無通信でタイムアウトになるまでの秒数は**未確認**。音声を止めている間は KeepAlive を数秒おきに送ること。

#### サーバーからのメッセージ

```json
{"type": "Begin", "id": "…", "expires_at": 1761550000, "configuration": {"model": "universal-3-6-pro", "...": "..."}}

{"type": "Turn",
 "turn_order": 3,
 "turn_is_formatted": true,
 "end_of_turn": true,
 "end_of_turn_confidence": 1.0,
 "transcript": "Good morning, thanks for joining the call.",
 "utterance": "Good morning, thanks for joining the call.",
 "language_code": "en",
 "language_confidence": 0.98,
 "speaker_label": "A",
 "speaker_confidence": 0.97,
 "words": [
   {"text": "Good", "start": 1200, "end": 1400, "confidence": 0.99, "word_is_final": true, "speaker": "A"}
 ]}

{"type": "SpeechStarted", "timestamp": 1200, "confidence": 0.9}
{"type": "SpeakerRevision", "revisions": [{"turn_order": 1, "speaker_label": "B", "...": "per-word speaker"}]}
{"type": "Termination", "audio_duration_seconds": 1800, "session_duration_seconds": 1805}
```

- 部分結果は `end_of_turn: false` で、各 word は `word_is_final: false` (確定済みの語は true)。ターン末に `end_of_turn: true` と `turn_is_formatted: true` の Turn が届く (3.6 Pro は常に整形済み)。同じ `turn_order` の Turn は**置き換える**。
- `speaker_label` は約 1 秒未満のターンでは `PENDING`。最初の 1〜2 ターンは誤割り当てが起きやすい。`SpeakerRevision` を受けたら UI の過去ターンの話者を書き換える (中間の訂正には `speaker_labels_revision_interval_ms` (最小 120000) が必要)。
- `language_code` と `language_confidence` は `language_detection=true` のとき Turn ごとに付く。語単位の言語ラベルはない。
- `words[].start` / `end` の単位は ms と推定 (**要確認**)。
- サンプルの値は説明用で、実際のペイロードの全フィールドが一度に揃うことは公式例で確認できていない。

#### メッセージシーケンスの例

```text
C→S  [open] wss://streaming.assemblyai.com/v3/ws?speech_model=universal-3-6-pro&sample_rate=16000&encoding=pcm_s16le&speaker_labels=true&language_detection=true
S→C  {"type":"Begin",...}
C→S  binary 100 ms PCM  (repeat)
S→C  {"type":"Turn","turn_order":0,"end_of_turn":false,"transcript":"","words":[{"text":"今日は","word_is_final":false,...}]}
S→C  {"type":"Turn","turn_order":0,"end_of_turn":true,"turn_is_formatted":true,"transcript":"今日は…","speaker_label":"A","language_code":"ja",...}
C→S  {"type":"Terminate"}
S→C  {"type":"SpeakerRevision",...}   (final revision, if speaker_labels)
S→C  {"type":"Termination",...}
S→C  [close]
```

### 2.3 第 3 候補: Deepgram Nova-3 multi (要点のみ)

```text
URL: wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&encoding=linear16&sample_rate=16000&channels=1
     &interim_results=true&endpointing=100&utterance_end_ms=1000&smart_format=true&diarize=true&vad_events=true
Auth (server): Authorization: Token <API_KEY>   (or Bearer <JWT> from POST https://api.deepgram.com/v1/auth/grant {"ttl_seconds":30..3600})
Auth (browser): Sec-WebSocket-Protocol: token, <API_KEY>    // documented; JWT via subprotocol is UNVERIFIED
Audio: binary linear16 frames
Control: {"type":"KeepAlive"} (every 3-5 s when idle; 10 s inactivity => NET-0001 close)
         {"type":"Finalize"}  {"type":"CloseStream"}  {"type":"Configure","keyterms":[...]}
Results: {"type":"Results","is_final":bool,"speech_final":bool,"from_finalize":bool,"start":s,"duration":s,
          "channel":{"alternatives":[{"transcript":"...","confidence":0.9,
             "words":[{"word","start","end","confidence","punctuated_word","speaker","language"}]}]}}
Other: {"type":"UtteranceEnd","channel":[0,1],"last_word_end":s}  {"type":"SpeechStarted"}  {"type":"Metadata"}
SDK: @deepgram/sdk 5.16.0
```

- `diarize` は非推奨扱いで、代わりに `diarize_model=latest|v1` を使う。ストリーミングでは v2 は使えない。

### 2.4 採用しなかった理由 (要約)

- **Google Chirp 3**: ストリーミングで話者分離ができない。
- **OpenAI `gpt-live-transcribe`**: 話者ラベルもタイムスタンプもなく、サーバー VAD にも非対応。
- **ElevenLabs Scribe v2 RT / Gladia**: リアルタイム話者分離がない。
- **Azure**: 同一文内のコードスイッチングに非対応と明記されている。遅延 (TTFS 約 1 秒) と価格も不利。ただし英語の精度は最上位なので、英語専用の会議なら候補になる。
- **Speechmatics**: 日英のバイリンガルモデルがない。Melia 1 のリアルタイム版は話者分離に非対応。
- **Amazon**: 遅延が大きく、日本語の話者分離と多言語識別が未確認。

---

## 3. Zoom 音声の取得方法

### 3.1 Zoom RTMS (Realtime Media Streams): 推奨 (本番)

**状態**: 2025-06 に GA。2026-05〜06 からセルフサービスで購入できるようになった (Pay as You Go、100 クレジット、500 クレジットのプラン)。Meetings、Webinars、Video SDK、Contact Center に対応。

**仕組み**:
1. ホスト側のアカウントで RTMS アプリを自動開始するか、アプリ (またはホスト) が REST API / Zoom Apps SDK で開始する。
2. Zoom がアプリに Webhook `meeting.rtms_started` (payload: `meeting_uuid`、`rtms_stream_id`、`server_urls` など) を送る。
3. バックエンドが**シグナリング WebSocket** に接続してハンドシェイクし、レスポンスでメディアサーバーの URL を受け取る。
4. **メディア WebSocket** に接続してハンドシェイクし、音声、映像、文字起こし、チャットを受け取る。

**参加者別の音声**: ○。`media_params.audio.data_opt = 2` (`AUDIO_MULTI_STREAMS`) にすると「アクティブな話者ごとに別ストリームで出力される (20 ms あたり最大 3 話者)」。各パケットに `user_id` と `user_name` が付く。`data_opt = 1` (`AUDIO_MIXED_STREAM`、既定値) はミックス音声で、`user_id = 0`。この場合の話者はアクティブスピーカーイベントで推定する。

**音声形式**: 既定値は raw PCM L16、16 kHz、mono、20 ms ごと。base64 の JSON で届く。`send_rate` は 20 ms の倍数で、最大 1000 ms。

**要件**:
- Zoom アカウント: Pro / Business / Enterprise に加えて、**Zoom Developer Pack (クレジット)** が必要。Basic アカウントは不可 (エラー 2310)。無料トライアルは同時 5 ストリーム、Developer Pack は 2,000 ストリーム。
- 料金: 分単位のクレジット消費。フォーラムでは「文字起こしなし 0.01 クレジット/分、ありで 0.02 クレジット/分」「$0.01/ストリーミング分」という報告があるが、**公式の単価は未確認**。
- Marketplace に **General アプリ** (OAuth) を作成する。
  - スコープ: 公式クイックスタートで確認できたのは `meeting:read:meeting_audio`。`meeting:read:meeting_transcript` なども必要に応じて追加する (正確な文字列は**要確認**。アカウントで RTMS が有効化されないとスコープ自体が表示されないという報告が多い)。
  - Event Subscriptions に `meeting.rtms_started` と `meeting.rtms_stopped` を追加し、公開 HTTPS の Webhook URL を設定する。反映まで 1〜2 分かかる。
- アカウント管理者が設定で「アプリによるリアルタイム会議コンテンツへのアクセス」(Allow apps to access meeting content / Share realtime meeting content with apps) を有効にする。必要ならアプリを自動開始に設定する。
- 開始できるのはホストまたは代替ホストのみ (それ以外はエラー 2308)。外部の会議では**ホストに承認ダイアログ**が出る (承認は全メディア一括で、部分承認はできない)。ホスト側の組織が RTMS を無効にしていると使えない。ホストとアプリ所有者の Zoom クライアントは 6.5.5 以上が必要。
- REST での開始: `PATCH https://api.zoom.us/v2/live_meetings/{meetingId}/rtms_app/status`、body は `{"action":"start","settings":{"client_id":"<app client id>","participant_user_id":"<optional>"}}`、成功すると 204。2026-01 からは、ホストの OAuth トークンを使えばホストが入室する前でも開始できる。
- 制約: ブレイクアウトルームは取得できない (2026-01 時点)。切断後にセッションを再開できず、新しい `meeting.rtms_started` を待つ必要がある。アプリ所有者が退室すると停止する (自動開始の場合を除く)。
- Webhook の検証:
  - URL 検証: `event = "endpoint.url_validation"` で届いた `payload.plainToken` に対し、`{"plainToken", "encryptedToken": HMAC_SHA256_hex(webhookSecretToken, plainToken)}` を 3 秒以内に返す。
  - 署名: `x-zm-signature == "v0=" + HMAC_SHA256_hex(webhookSecretToken, "v0:" + x-zm-request-timestamp + ":" + rawBody)` を照合する。

**npm SDK**: `@zoom/rtms` 1.1.0 (Node 22 以上、Node 24 LTS 推奨)。**対応は linux-x64 と darwin-arm64 のみで、Windows は非対応。** 開発機が Windows なので、WSL や Docker で動かすか、下記の**生 WebSocket プロトコルを TypeScript で実装する**ことを推奨する。SDK の API は `rtms.onWebhookEvent(({event, payload}) => ...)`、`new rtms.Client()`、`client.onAudioData((data, timestamp, metadata) => ...)`、`client.join(payload)`。環境変数は `ZM_RTMS_CLIENT` と `ZM_RTMS_SECRET`。

**生プロトコル (WebSocket、JSON)**:

```text
signature = hex( HMAC_SHA256( key = CLIENT_SECRET, msg = `${CLIENT_ID},${meeting_uuid},${rtms_stream_id}` ) )

1) Signaling WS  → connect to payload.server_urls
   C→S {"msg_type":1,"protocol_version":1,"sequence":1,"meeting_uuid":"...","rtms_stream_id":"...",
        "signature":"...","buffer_data":false}
   S→C {"msg_type":2,"status_code":0,"media_server":{"server_urls":{"audio":"wss://...","video":"wss://...",
        "transcript":"wss://...","all":"wss://..."}}}

2) Media WS (audio URL)
   C→S {"msg_type":3,"protocol_version":1,"sequence":0,"meeting_uuid":"...","rtms_stream_id":"...",
        "signature":"...","media_type":1,"payload_encryption":false,
        "media_params":{"audio":{"content_type":2,"sample_rate":1,"channel":1,"codec":1,
                                  "data_opt":2,"send_rate":20}}}
   S→C {"msg_type":4,"status_code":0,"media_params":{...}}

3) Signaling WS
   C→S {"msg_type":7,"rtms_stream_id":"..."}             // CLIENT_READY_ACK

4) Keep-alive (both sockets; server sends every ~10 s)
   S→C {"msg_type":12,"timestamp":1727384349123}
   C→S {"msg_type":13,"timestamp":1727384349123}         // must echo the same timestamp

5) Audio data (media WS)
   S→C {"msg_type":14,"content":{"user_id":16778240,"user_name":"John Smith",
        "data":"<base64 PCM L16 16k mono>","timestamp":1738392033699}}

Enums:
  media_type bitmask: AUDIO=1 VIDEO=2 DESKSHARE=4 TRANSCRIPT=8 CHAT=16 ALL=32
  content_type: RTP=1 RAW_AUDIO=2 RAW_VIDEO=3 FILE_STREAM=4 TEXT=5
  sample_rate:  SR_8K=0 SR_16K=1 SR_32K=2 SR_48K=3
  codec:        L16=1 G711=2 G722=3 OPUS=4
  data_opt:     AUDIO_MIXED_STREAM=1 AUDIO_MULTI_STREAMS=2
  other msg_type: 8 stream state, 9 session state, 17 transcript, 18 chat, 21/22 stream close
```

- `payload_encryption` の扱いは**要確認**: 公式の例 (msg_type 4) に `"payload_encrypted": true` が出てくる。
- RTMS 自体も文字起こし (msg_type 17、話者付き、`src_language` / `enable_lid`) を提供している。ただし日本語の品質と遅延は**未確認**で、品質面から Soniox を推奨する。保険として併用はできる。

### 3.2 Zoom Meeting SDK の raw audio ボット

- Linux / Windows / macOS の Meeting SDK で、ボットとして会議に入室し、raw audio を取得する。コールバックは参加者別の `onOneWayAudioRawDataReceived(data, node_id/userId)` とミックスの `onMixedAudioRawDataReceived(data)`。サンプルレートは `data` から取得する (32 kHz という報告あり)。
- **2026-03-02 以降**、自分のアカウント以外の会議に参加するには ZAK または **OBF トークン**による認可が必要になった。OBF の場合は認可したユーザーが会議に在室している必要がある。外部会議用のアプリは Zoom の審査も必要。
- raw 録音の開始には、ホスト/共同ホストであるか、ホストの録音許可か、`recording_token` が必要。
- Linux SDK はドキュメントもサポートも限定的。C++ バインディングと常駐インフラの運用コストが高く、**RTMS か Recall.ai を優先すべき**。

### 3.3 Recall.ai

- **Meeting Bot API**: ボットが Zoom、Google Meet、Teams に参加し、`recording_config.audio_separate_raw = {}` と `realtime_endpoints: [{"type":"websocket","url":"wss://...","events":["audio_separate_raw.data"]}]` を指定すると、参加者別の音声を WebSocket で受信できる。
  - 形式: base64 の S16LE、16 kHz、mono。メッセージは `{"event":"audio_separate_raw.data","data":{"data":{"buffer":"<b64>","timestamp":{"absolute":"ISO8601","relative":1.23},"participant":{"id":1,"name":"...","is_host":false,"platform":"...","email":null}}, "bot":{...}}}`。
  - 同時に扱えるのは大きい声の上位 16 話者まで。画面共有の音声は含まれない。4 コアボットの利用が推奨されている (+$0.10/時)。
  - API: `POST https://us-west-2.recall.ai/api/v1/bot`。Authorization ヘッダーの書式 (`Token <key>` かどうか) は**要確認**。
- **価格**: $0.50/時 (秒単位課金、最初の 5 時間は無料)。内蔵の文字起こしは +$0.15/時。スタートアップ向けに $0.25/時 の枠もある。リアルタイム文字起こしでは Deepgram や AssemblyAI などの外部プロバイダを連携でき、イベント名は `transcript.data` と `transcript.partial_data`。外部プロバイダに Soniox が含まれるかは**未確認**。そもそも Soniox を使うなら、音声を受け取って自前で接続すればよい。
- **Meeting Direct Connect for Zoom RTMS**: RTMS をマネージドで受けるサービス。Desktop Recording SDK (ボットなしでローカルの会議アプリを録音) もある。料金はボットと同じ。
- **向いているケース**: Zoom 以外の会議ツールも必要、Developer Pack を自前で運用したくない、早く市場に出したい、の場合。
- **注意**: ボットが参加者として見える。外部の Zoom 会議における OBF 要件への Recall 側の対応状況は**未確認**。

### 3.4 ブラウザでのキャプチャ (MVP / 設定ゼロ)

| 環境 | 方法 | 取れる音 | 備考 |
| --- | --- | --- | --- |
| **Zoom Web クライアント** (Chrome タブ) | `getDisplayMedia({video:true, audio:true})` でユーザーが Zoom のタブを選び、「タブの音声も共有」にチェックする | リモート参加者の声 (自分の声は含まない) | macOS、Windows、Linux、ChromeOS で動く。`suppressLocalAudioPlayback:false` (既定値) なら本人も音を聞き続けられる |
| **Zoom デスクトップ (Windows)** | 画面全体を共有し、「システム音声も共有」を選ぶ。`systemAudio:"include"` | OS が再生する全音声 (Zoom の相手の声に加えて、通知音なども混ざる) | Chrome 74 以降の Windows と ChromeOS で可 |
| **Zoom デスクトップ (macOS)** | 画面またはウィンドウの共有でシステム音声を選ぶ | 同上 | 第三者の検証によると **Chrome 141 以降かつ macOS 14.2 以降**で可能になった (公式リリースノートでは**未確認**)。`windowAudio` (`exclude`/`window`/`system`) も Chrome 141 で導入された |
| 自分の声 | `getUserMedia` のマイクを**別ストリーム** (話者 = 自分) として送る | 本人 | スピーカーで聞いていると相手の声もマイクに回り込み、重複する (下記) |

- `systemAudio` や `windowAudio` はあくまでヒントで、ブラウザに無視されることがある。必ず `stream.getAudioTracks().length` を確認し、音声トラックがなければユーザーに再選択を促す。
- タブやシステムの音声は Zoom 側でミックス済みなので、**話者名は取れない**。ASR の話者分離 (Soniox) に頼り、UI で名前を対応付ける。
- 自分のアプリが鳴らす音がシステム音声に混入するのを防ぐ制約 (`restrictOwnAudio` など) は MDN に記載がなく、**未確認**。エージェントが音を鳴らさない設計にすれば、この問題は避けられる。

### 3.5 「全員が自分のブラウザでマイクを送る」方式

**利点**: 参加者ごとに 1 ストリームになり、ログインしたユーザー名をそのまま話者にできる。話者分離が不要になり、名前付けも正確。

**問題点**:
1. **Zoom でスピーカーを使っている場合**: 自分のマイクに相手の声 (Zoom の再生音) が回り込み、同じ発話が複数人の名前で重複して文字起こしされる。Chrome の `echoCancellation` が Zoom デスクトップアプリの再生音を参照信号として除去できるかは**未確認** (Chrome が自分で再生した音以外は期待できないと考えたほうがよい)。
2. **対面会議 (A) で全員がノート PC を開いている場合**: 全員のマイクが全員の声を拾う (クロストーク)。
3. ネットワーク遅延が端末ごとに違うので、端末間の時刻合わせが必要。

**緩和策**:
- **ヘッドホン (イヤホン) の使用を必須にする** (Zoom ケースでは最も効く)。
- **支配的話者ゲーティング**: サーバーで各ストリームの短時間エネルギー (RMS、20〜50 ms 窓) を時刻を揃えて比較し、最も大きい (かつ差が閾値以上の) ストリームの確定トークンだけを採用する。時刻合わせには、各クライアントから `performance.timeOrigin + currentTime` とサーバー時刻とのオフセットを NTP 風に測って付与する。
- **テキストによる重複排除**: 時間的に重なる (±1 秒) 確定セグメント同士の正規化文字列の類似度 (編集距離など) が高ければ、エネルギーが大きい側だけを残す。
- 対面会議では「1 台の部屋マイク + Soniox の話者分離」を基本にし、個人端末は**話者名の付与 (声の登録や、話し始めの UI 操作)** に限って使う設計が安全。
- Zoom ミュートの連動 (ミュート中は送らない) はブラウザから Zoom の状態を取れないので不可。代わりにアプリ内のミュートボタンと VAD で対応する。

### 3.6 Zoom 推奨ロードマップ

1. **MVP**: §3.4 のブラウザキャプチャ (タブまたはシステム音声と、自分のマイク) を Soniox (話者分離 ON) に送る。設定ゼロですぐ動く。
2. **本番 (自社または自組織がホストの会議)**: RTMS で `AUDIO_MULTI_STREAMS` を使い、参加者ごとに Soniox ストリームを張って名前付きで文字起こしする。Developer Pack の購入、General アプリの作成、Webhook の公開、管理者による設定有効化が前提。
3. **外部会議や他の会議ツールも必要になったら**: Recall.ai (ボット、または RTMS Direct Connect) を追加の音声ソースアダプタとして実装する。

---

## 4. ブラウザでの音声キャプチャのベストプラクティス

### 4.1 getUserMedia の制約 (部屋マイク)

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    echoCancellation: false,   // set true only if this laptop also plays remote audio (hybrid meeting)
    noiseSuppression: false,   // ASR models are trained on noisy speech; NS artifacts can hurt WER/CER
    autoGainControl: false,    // A/B test: true may help quiet far-field talkers but causes pumping
  },
});
```

- 3 つとも**明示的に指定すること**。ブラウザによっては、`echoCancellation` を false にすると他の 2 つの既定値も連動して変わる。
- Safari では false にしても処理が外れないという報告がある (WebKit bug)。
- 部屋マイクで遠くの話者が小さく録れる場合は、AGC=true と固定ゲイン (Worklet 内で ×2〜4 倍、クリップ防止付き) を、§5 の評価で比較する。この推奨は経験則で、ASR の公式ベンチマークはない。
- **ハイブリッド会議** (部屋の PC が Zoom の相手の声をスピーカーで流している場合) は `echoCancellation:true` にする。ただし Chrome の AEC が除去できるのは Chrome 自身が再生した音だけと考えたほうがよい (**未確認**)。Zoom Web クライアントを同じ Chrome で動かす構成が有利。

### 4.2 AudioWorklet で 16 kHz PCM16 mono に変換する

- `new AudioContext({ sampleRate: 16000 })` を作ると、Chrome は `MediaStreamAudioSourceNode` の入力を内部でリサンプルする。
- Firefox ではマイクのレートと異なる sampleRate の AudioContext に MediaStream をつなぐと `NotSupportedError` になる (Firefox のテストが、その仕様どおりに失敗することを期待している)。**対策: 既定レート (48 kHz など) の AudioContext を使い、Worklet 内でダウンサンプルする**のが最も移植性が高い。
- Worklet の `process()` は 128 フレーム単位で呼ばれる。この中でリサンプル (簡易的には区間平均。品質を上げるならローパス FIR + 間引き、または線形補間) → Float32 から Int16 への変換 (クリップ) → 必要な長さまで蓄積 → `port.postMessage(buf, [buf])` で転送する。
- **チャンク長は 40〜100 ms を推奨する** (Soniox の公式サンプルは 120 ms、AssemblyAI は 50〜1000 ms が必須)。100 ms なら 1,600 サンプル = 3,200 bytes。小さくすると遅延は減るが、フレーム数とオーバーヘッドが増える。
- `MediaRecorder` (webm/opus) は timeslice とコンテナのオーバーヘッドで遅延が増えるので、低遅延が目的なら PCM を推奨する。

```js
// PcmCaptureWorklet.js — downsamples to 16 kHz mono PCM16 and posts fixed-size chunks.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;          // sampleRate is a global in AudioWorkletGlobalScope
    this.chunkSamples = (options.processorOptions?.chunkMs ?? 100) * 16;  // 16 samples per ms at 16 kHz
    this.out = new Int16Array(this.chunkSamples);
    this.outIndex = 0;
    this.acc = 0; this.accCount = 0; this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      // box-filter decimation: average input samples that fall into one output sample
      this.acc += ch[i]; this.accCount++; this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.accCount));
        this.out[this.outIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.acc = 0; this.accCount = 0;
        if (this.outIndex === this.chunkSamples) {
          const buf = this.out.buffer;
          this.port.postMessage(buf, [buf]);
          this.out = new Int16Array(this.chunkSamples);
          this.outIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor);
```

```ts
// main thread
const ctx = new AudioContext();                         // default device rate (portable)
await ctx.audioWorklet.addModule('/PcmCaptureWorklet.js');
const src = ctx.createMediaStreamSource(stream);
const node = new AudioWorkletNode(ctx, 'pcm-capture', { processorOptions: { chunkMs: 100 } });
node.port.onmessage = (e) => ws.readyState === WebSocket.OPEN && ws.send(e.data);  // binary frame
src.connect(node);                                      // no need to connect to destination
```

- 区間平均 (box filter) は簡易的なアンチエイリアスしかできない。ASR には概ね十分だが、§5 の評価で FIR 版と比較するとよい。
- タブまたはシステム音声とマイクを 1 本にミックスする場合は Worklet の手前で `GainNode` に合流させる。ただし**別ストリームのまま送るほうが話者の帰属に有利**。
- 記録用に、各チャンクのキャプチャ時刻 (`ctx.currentTime` から換算) を保持しておく。ASR の `start_ms` を実時刻に対応付けるのに使う。

### 4.3 VAD

- **Soniox や AssemblyAI へは音声を止めずに送り続けるのが基本**。止めると文脈が失われ、話者分離の精度も落ちる。どちらも課金は接続時間なので、送信を止めても費用は減らない。
- VAD の用途:
  1. 発話終了後に約 200 ms の無音が続いたら Soniox に `{"type":"finalize"}` を送り、確定を早める (公式推奨。エンドポイント検出と併用するか、どちらか一方を使う)。
  2. UI の「話している」インジケーター。
  3. §3.5 の支配的話者ゲーティング。
  4. 長い無音 (例: 休憩で 5 分以上) の間は無音 PCM ではなく keepalive に切り替え、帯域を節約する。
- ライブラリ: `@ricky0123/vad-web` 0.0.31 (Silero VAD、ONNX)。軽量な代替は RMS 閾値とハングオーバーによる自前実装。

### 4.4 その他

- 再接続: 直近 2〜5 秒の PCM をリングバッファに保持し、再接続後に先頭へ送り直して取りこぼしを減らす (重複したテキストは時刻で除去する)。Soniox の一時キーは期限が短いので、再接続のたびに発行し直す。
- 長時間会議: Soniox は 1 ストリーム 300 分、AssemblyAI は 3 時間が上限。無音区間を狙って計画的に張り替える。
- 認証情報は `.env` (`SONIOX_API_KEY`、`ASSEMBLYAI_API_KEY`、`ZOOM_CLIENT_ID`、`ZOOM_CLIENT_SECRET`、`ZOOM_WEBHOOK_SECRET_TOKEN`) に置き、ブラウザには一時キーだけを渡す。

---

## 5. 選定のための評価手順 (推奨)

1. 実際の会議音声を 30〜60 分用意する (日本語のみ、英語のみ、日英混在。部屋マイク 1 本の録音と、Zoom 経由の音声)。人手で正解テキストと話者を付ける。
2. 同じ PCM を実時間ペースで各 API (Soniox、AssemblyAI、Deepgram。比較用に Azure も) に流す。
3. 指標:
   - 日本語は **CER** (NFKC 正規化、句読点除去、全角/半角の統一。数字や漢字/かな表記ゆれの扱いはルールを固定する)。
   - 英語は WER。混在は MER (Mixed Error Rate)。
   - 話者分離は DER または cpWER。
   - 遅延: 発話開始から最初の部分トークンまで、発話終了から確定まで。それぞれ p50 と p90。
4. 固有名詞 (社名、製品名、人名) については、`context` や keyterms の有無による改善幅も測る。
5. Soniox Compare (soniox.com/compare) で、同じ音声を各社に流した生の出力を目視比較することもできる。

---

## 6. 参考文献 (URL)

### Soniox
- WebSocket API: https://soniox.com/docs/stt/api-reference/websocket-api
- Real-time transcription: https://soniox.com/docs/stt/rt/real-time-transcription
- WebSocket authentication: https://soniox.com/docs/guides/websocket-authentication
- Temporary API keys: https://soniox.com/docs/guides/temporary-api-keys
- Direct stream: https://soniox.com/docs/guides/direct-stream
- Connection keepalive: https://soniox.com/docs/stt/rt/connection-keepalive
- Manual finalization: https://soniox.com/docs/stt/rt/manual-finalization
- Endpoint detection: https://soniox.com/docs/stt/rt/endpoint-detection
- Models: https://soniox.com/docs/stt/models
- Supported languages: https://soniox.com/docs/stt/concepts/supported-languages
- Language identification: https://soniox.com/docs/stt/concepts/language-identification
- Speaker diarization: https://soniox.com/docs/stt/concepts/speaker-diarization
- Context: https://soniox.com/docs/stt/concepts/context
- Node SDK realtime: https://soniox.com/docs/sdk/node-SDK/stt/realtime-transcription
- Pricing: https://soniox.com/pricing
- Benchmarks (Pipecat, English): https://soniox.com/benchmarks

### AssemblyAI
- Streaming API reference: https://www.assemblyai.com/docs/api-reference/streaming-api/streaming-api
- Generate streaming token: https://www.assemblyai.com/docs/api-reference/streaming-api/generate-streaming-token.md
- Speaker labels (streaming): https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels.md
- Message sequence: https://www.assemblyai.com/docs/streaming/message-sequence.md
- Models reference: https://www.assemblyai.com/llms/models.md
- Pricing reference: https://www.assemblyai.com/llms/pricing.md
- Universal-3 Pro streaming: https://www.assemblyai.com/docs/streaming/universal-3-pro.md

### Deepgram
- Live streaming reference: https://developers.deepgram.com/reference/speech-to-text/listen-streaming
- Models & languages: https://developers.deepgram.com/docs/models-languages-overview
- Multilingual code-switching: https://developers.deepgram.com/docs/multilingual-code-switching
- Diarization: https://developers.deepgram.com/docs/diarization
- Keep alive: https://developers.deepgram.com/docs/keep-alive
- Sec-WebSocket-Protocol: https://developers.deepgram.com/docs/using-the-sec-websocket-protocol
- Token-based auth: https://developers.deepgram.com/guides/fundamentals/token-based-authentication
- Pricing: https://deepgram.com/pricing
- Flux Multilingual changelog: https://developers.deepgram.com/changelog

### その他の ASR
- Speechmatics languages: https://docs.speechmatics.com/speech-to-text/languages
- Speechmatics pricing: https://www.speechmatics.com/pricing
- Speechmatics Melia: https://speechmatics.com/company/articles-and-news/introducing-melia-multilingual-speech-to-text-model
- Speechmatics realtime latency: https://docs.speechmatics.com/features/realtime-latency
- Azure language identification: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification
- Azure LID + diarization: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/configure-language-identification-diarization
- Google Chirp 3: https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3
- OpenAI realtime transcription: https://developers.openai.com/api/docs/guides/realtime-transcription
- ElevenLabs realtime STT API: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
- ElevenLabs STT capabilities: https://elevenlabs.io/docs/capabilities/speech-to-text
- Gladia live init: https://docs.gladia.io/api-reference/v2/live/init
- Amazon Transcribe languages: https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html

### Zoom
- RTMS overview: https://developers.zoom.us/docs/rtms/
- RTMS for meetings: https://developers.zoom.us/docs/rtms/meetings/
- RTMS quickstart (WebSockets): https://developers.zoom.us/docs/rtms/meetings/quickstart-websockets/
- RTMS media handling: https://developers.zoom.us/docs/rtms/meetings/media/
- RTMS data types: https://developers.zoom.us/docs/rtms/data-types/
- RTMS media parameter definitions: https://developers.zoom.us/docs/rtms/media-parameter-definition/
- RTMS universal events: https://developers.zoom.us/docs/rtms/event-reference/universal-events/
- RTMS troubleshooting: https://developers.zoom.us/docs/rtms/troubleshooting.md
- RTMS UX overview: https://developers.zoom.us/docs/rtms/meetings/ux-overview/
- RTMS start before host joins (changelog 2026-01-18): https://developers.zoom.us/changelog/rtms/january-18-2026
- RTMS self-service purchasing: https://devforum.zoom.us/t/rtms-self-service-purchasing-is-now-available/144524
- RTMS SDK (GitHub): https://github.com/zoom/rtms
- Webhooks (CRC / signature): https://developers.zoom.us/docs/api/webhooks/
- Meeting SDK: https://developers.zoom.us/docs/meeting-sdk/
- Meeting SDK OBF FAQ: https://developers.zoom.us/docs/meeting-sdk/obf-faq/
- Recall.ai: RTMS constraints: https://www.recall.ai/blog/understanding-zoom-rtms-behavior-and-its-constraints

### Recall.ai
- Pricing: https://www.recall.ai/pricing
- Separate audio per participant (realtime): https://docs.recall.ai/docs/how-to-get-separate-audio-per-participant-realtime
- Meeting Direct Connect for Zoom RTMS: https://docs.recall.ai/docs/meeting-direct-connect-for-zoom-rtms

### ブラウザ
- MDN getDisplayMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- macOS Chrome system audio (Addpipe, 2026-02): https://blog.addpipe.com/getdisplaymedia-allows-capturing-the-screen-with-system-sounds-on-chrome-on-macos/
- Chrome 109 screen sharing (suppressLocalAudioPlayback): https://developer.chrome.com/blog/screen-sharing-improvements-in-chrome-109
- Firefox cross-rate MediaStreamAudioSourceNode test: https://searchfox.org/firefox-main/source/dom/media/webrtc/tests/mochitests/test_getUserMedia_nonDefaultRate.html

### npm パッケージのバージョン (2026-10-27 に `npm view` で確認)
- `@soniox/node` 2.4.0、`@soniox/client` 2.4.0、`@soniox/speech-to-text-web` 1.4.0
- `assemblyai` 4.41.7
- `@deepgram/sdk` 5.16.0
- `@zoom/rtms` 1.1.0
- `@speechmatics/real-time-client` 8.6.0
- `microsoft-cognitiveservices-speech-sdk` 1.53.0
- `@elevenlabs/elevenlabs-js` 2.74.0
- `openai` 7.44.0
- `@recallai/desktop-sdk` 2.0.41
- `@ricky0123/vad-web` 0.0.31
- `ws` 8.22.0

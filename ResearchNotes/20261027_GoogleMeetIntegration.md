# Google Meet 連携調査 (2026-10-27)

EkklesiazousAI (会議をリアルタイムに聞き、共有キャンバスに情報を出す AI エージェント。Vue 3 クライアントと Node.js サーバー) を Google Meet に対応させるための調査メモ。
Zoom (RTMS とブラウザキャプチャ) にはすでに対応している。音声認識の前提と既存のキャプチャ方式は [20261027_SpeechRecognitionAndMeetingAudioCapture.md](./20261027_SpeechRecognitionAndMeetingAudioCapture.md) を参照。

- 調査日: 2026-10-27。Google 公式ドキュメントを優先した (ページの最終更新日は参考文献に記載)。
- **未確認** = 公式の一次資料で確かめられなかった項目。**要確認** = 資料間で食い違う項目、または二次情報しかない項目。
- 価格は公開されている従量課金の価格。契約前に必ず再確認すること。

---

## 1. 目的

### 1.1 要件

1. Meet の会議音声を、できれば**参加者ごとに名前付き**で Soniox (PCM16 / 16 kHz / mono) に流す。
2. 共有キャンバス (Miro 風) を Meet の参加者全員に見せる。
3. 低遅延であること。部分結果は 300〜500 ms 以内を目指す。

### 1.2 要約 (TL;DR)

- **Meet Media API (公式のリアルタイム音声 API) は、新規には使えない。** 2026-10-01 更新の公式ドキュメントに「The Google Meet Media API is no longer accepting new signups.」と書かれている。状態は今も Developer Preview で、GA の発表はない。2026-09-03 版までは「Cloud プロジェクト、OAuth プリンシパル、**会議の全参加者**が Developer Preview Program に登録していること」が必須だった。
- **Meet Add-ons SDK は GA (2024-09)。** キャンバスを Meet の**メインステージ (参加者全員が見られる)** とサイドパネルに埋め込める。ただし音声、映像、参加者リストにはアクセスできない。公開 Marketplace の審査基準には「**ボットを招待する機能や、ボットの存在に依存する機能を持ってはならない**」とある。
- **Meet REST API には、リアルタイム音声も逐次の文字起こしもない。** 文字起こしは会議後に取得するものになる。ただし参加者の入退室イベントと、会議中の参加者リスト (表示名) は取れる。
- **MVP は、ブラウザで Meet タブの音声とホストのマイクを取り込む方式** (既存の `onlineHostCapture`) で、追加の承認は要らない。話者名は Soniox の話者分離と UI での名前付けで補う。
- **本番は 2 本立てにする。** (A) キャンバスは Meet アドオン (メインステージ) で配る。(B) 参加者ごとに名前付きの音声が必要なら、サードパーティのボット (Recall.ai。自前で運用するなら Attendee) をアドオンとは切り離して使う。Media API は GA になったら追加アダプタとして実装する。

---

## 2. 選択肢比較表

| # | 選択肢 | 取れる音声 | 話者名 | 会議内での見え方 | 主な前提・要件 | 費用 | 2026-10 時点の状態 | 評価 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **ブラウザキャプチャ** (Meet タブ音声 + ホストのマイク) | リモート参加者のミックス + ホスト本人 (別ストリーム) | なし。ASR の話者分離 + UI で名前付け (REST API の参加者リストを名前の候補に使える) | 何も表示されない | Chromium 系のデスクトップ版ブラウザ。Meet を通常のタブで開く。ホストがタブを選び音声共有を ON にする。ヘッドホンを推奨 | 0 円 (ASR 料金のみ) | すぐ使える | **MVP** |
| 2 | 全員が自分のマイクをアプリから送る (`onlinePerParticipant`) | 1 人 1 ストリーム | ログイン名をそのまま使える | 何も表示されない | 全員がアプリを開く。ヘッドホンが必須 (回り込みと重複を防ぐため) | 0 円 | すぐ使える | 少人数の補助 |
| 3 | **Meet Media API** (公式 WebRTC) | 仮想ストリーム 3 本 (声の大きい 3 人)。CSRC で参加者を特定できる | `participants` データチャネルで `displayName` が取れる | 同意ダイアログと使用中の通知が出る | Developer Preview に登録済みであること。制限付きスコープ。Workspace 管理者による有効化。暗号化や透かしのある会議は不可 | API 料金は記載なし | **新規登録を終了** | GA 待ち |
| 4 | **Meet Add-ons SDK** | **なし** | なし (取れるのは `meetingId` / `meetingCode` だけ) | サイドパネルとメインステージに表示される | Cloud プロジェクト、Marketplace SDK、HTTPS ホスティング、One Tap サインイン | 0 円 | GA | **キャンバス配布の本命** |
| 5 | Meet REST API + Workspace Events | なし (文字起こしは会議後) | 会議中の参加者リストと入退室イベントは取れる | 何も表示されない | `meetings.space.readonly` などの OAuth スコープ | 0 円 | GA | 名前候補の補助 |
| 6 | **Recall.ai Meeting Bot** | 参加者ごとの 16 kHz S16LE (同時に最大 16 人の発話者) | 参加者オブジェクトに `name` が入る | ボットが参加者として見え、入室の承認が要る | API キー。公開 `wss://` エンドポイント | $0.50/時 (+ 内蔵文字起こし $0.15/時) | 使える | **本番の名前付き音声** |
| 7 | Recall.ai Meeting Direct Connect (Media API 経由) | Media API と同じ (関連性の高い 3 人) | Media API と同じ | Media API と同じ | Media API の前提をすべて満たすこと | 未確認 | プレビュー (Media API に依存) | 不可 |
| 8 | Attendee (ELv2、自前運用またはホスト版) | 参加者ごとの 8 kHz / 16 kHz PCM | `participant_uuid` → 入退室 Webhook で解決する | ボットが見える | Django + Postgres + Redis (Docker) | ホスト版は $0.50/時 (大口で $0.35/時まで下がる)。自前運用なら計算資源の費用のみ | 使える | 自前運用の代替 |
| 9 | Meeting BaaS | ストリーミングあり (参加者ごとに分かれるかは**未確認**) | 未確認 | ボットが見える | API キー | トークン $0.35〜0.50/時 + ストリーミングは +0.10〜0.20 トークン/時 (ページ内で記載が食い違う) | 使える | 予備 |
| 10 | Chrome 拡張 (`tabCapture` + DOM や字幕の読み取り) | タブ音声 | DOM から話者を推定する (壊れやすい) | 何も表示されない | 拡張の配布。Meet の UI 変更に弱い | 0 円 | 技術的には可能 | 非推奨 (参考) |

---

## 3. Meet Media API 詳細

### 3.1 状態と登録

- **リリース**: 2025-02-24 に Developer Preview として公開された (リリースノート)。2026-10-27 時点で GA の発表はない。
- **新規登録の終了**: overview、get-started、concepts、TS quickstart、`connectActiveConference` リファレンス (2026-10-01〜02 更新) のすべてに次の文言がある。
  > Developer Preview: The Google Meet Media API is no longer accepting new signups. We regularly evaluate features that are included in the Google Workspace Developer Preview Program and remain committed to supporting developer tools across Workspace.
- **以前の登録要件** (Wayback で確認した 2025-10-13 版と 2026-09-03 版の overview):
  > the Google Cloud project, OAuth principal, and all participants in the conference must be enrolled in the Developer Preview Program.
  - 現行版 (2026-10-01) からはこの文が消えている。既存の登録者に対して全参加者の登録がまだ必要かどうかは**要確認**。Recall.ai のドキュメント (2026-04 更新) も「all meeting participants need to be enrolled」としている。
  - 開発者フォーラム (2026-07) には、この要件のせいで外部顧客向けに提供できないという質問が出ているが、Google からの回答はない。
- **結論**: 新しいプロジェクトが今から Media API を本番に組み込むことはできない。インタフェースだけ用意して GA を待つ。

### 3.2 OAuth スコープ

| スコープ | 分類 | 用途 |
| --- | --- | --- |
| `https://www.googleapis.com/auth/meetings.conference.media.readonly` | Restricted | 音声 + 映像 |
| `https://www.googleapis.com/auth/meetings.conference.media.audio.readonly` | Restricted | 音声のみ |
| `https://www.googleapis.com/auth/meetings.conference.media.video.readonly` | Restricted | 映像のみ |
| `https://www.googleapis.com/auth/meetings.space.read` (get-started の表記) / `meetings.space.readonly` (TS quickstart の表記) | Sensitive | 会議メタデータの読み取り。メディア用スコープに加えて必要 (**表記ゆれがあるので要確認**) |

- 制限付き (Restricted) スコープには、スコープの審査と、Google 指定の評価機関によるセキュリティ評価 (少なくとも 12 か月ごと) が必要になる。例外は次の 3 つ。
  - Internal ユーザータイプ (自組織の Workspace だけで使い、プロジェクトが組織所有)
  - 個人利用
  - テストモード (登録したテストユーザーのみ)

### 3.3 接続方式 (WebRTC + REST によるシグナリング)

```
POST https://meet.googleapis.com/v2beta/{name=spaces/*}:connectActiveConference
Authorization: Bearer <user access token>
{ "offer": "<SDP offer>", "config": { "confirmationTimeout": "120s" } }   // config is optional; timeout <= 5 min
→ 200 { "answer": "<SDP answer>", "traceId": "..." }
```

- `name` は `spaces/{spaceId}` の形式。TS サンプルは `meetingSpaceId` に会議コードを渡している。
- 200 が返っても入室の完了を意味しない。その後のやり取りは WebRTC のデータチャネルで行う。
- **オファーの要件** (concepts / virtual-streams):
  - オファーは常にクライアント側が作る。DTLS では常にクライアント役になる (`a=setup:active`)。
  - 音声を受けるときは、**受信専用 (recvonly) の audio m-line をちょうど 3 本**入れる。コーデックは Opus。
  - 映像を受けるときは recvonly の video m-line を 1〜3 本入れる (VP8 / VP9 / AV1)。TS サンプルでは映像 0 本も指定できる。
  - データチャネルは必須で、ordered (順序保証) にする。`session-control` と `media-stats` は常に開いておく。TS サンプルはさらに `participants`、`media-entries`、`video-assignment` を開いている。m-line の順序は「audio → data channel → video」(サンプルのコメントによる)。
- **技術要件** (get-started):
  - VP8 / VP9 は libvpx、AV1 は dav1d で復号する。
  - 次のヘッダー拡張に対応する: Absolute Send Time、Transport-Wide Congestion Control、Absolute Capture Time、Dependency Descriptor、Audio Level Indication。
  - 指標一式 (client metrics) を定期的に送る。
  - libwebrtc は Chromium の安定版から 12 か月以内のものを使うことを推奨。帯域は 4 Mbps 以上。
  - API の既定レート上限は 6,000 リクエスト/分。

### 3.4 音声ストリームと参加者の対応付け

- **仮想ストリーム**: SFU が、固定された **3 本の SSRC** に、そのとき関連性の高い (= 声の大きい) 3 人の音声を振り分ける。SSRC はセッション中ずっと変わらない。誰の音声かは RTP ヘッダーの **CSRC** で判別する。CSRC は参加者ごとに一意で、入室から退室まで変わらない。
  - 4 人以上の場合: 声の大きい 3 人が流れ、順位が変わると SSRC の中身が切り替わる。
  - 3 人未満の場合: 使われない SSRC にはパケットが流れない。
- **対応付けの手順** (TS 型定義 `datachannels.d.ts` による):
  1. `media-entries` チャネルから `MediaEntry { participantKey, sessionName, audioCsrc, videoCsrcs, presenter, screenshare, audioMuted, ... }` が届く。
  2. `participants` チャネルから `Participant { participantKey, signedInUser{ user, displayName } | anonymousUser{ displayName } | phoneUser{ displayName (一部を伏せた電話番号) } }` が届く。
  3. ブラウザでは `RTCRtpReceiver.getContributingSources()` の `source` と `audioCsrc` を照合する (TS 参照実装の `internal_meet_stream_track_impl.ts` と同じ方法)。
  4. C++ 参照実装では `AudioFrame { pcm16, sample_rate, number_of_channels, contributing_source, is_from_loudest_speaker, absolute_capture_timestamp_ms }` が `OnAudioFrame()` に届くので、そのまま参加者に振り分けられる。
- **ASR への流し方 (GA 後の設計案)**: CSRC から participantKey、さらに displayName を引いて、参加者ごとに Soniox ストリームを開く。費用を抑えるなら SSRC 3 本に対して Soniox ストリームを 3 本だけ開き、確定トークンに CSRC を使って話者ラベルを付ける。
- 4 人目以降の小さな声は流れてこない。相槌や同時発話の取りこぼしが起こりうる。

### 3.5 同意、通知、制約

- 会議内に**同意できる人**がいないと接続できない。
  - Workspace の会議: 会議を所有する組織のメンバーが同意する。管理者は「ホスト組織の全員が同意できる (既定)」か「ホストまたは共同ホストだけが同意できる」かを選べる。
  - Gmail アカウントの会議: 開始した人が在室している必要がある。
  - `confirmationTimeout` (5 分以内) は、この確認操作の待ち時間と思われる。
- **ホストが Calendar の設定でサードパーティアプリを許可していない**と、接続は拒否される。
- **暗号化 (CSE) や透かしのある会議**、**未成年アカウントがいる会議**には接続できない。
- 接続すると、ホスト、共同ホスト、ホストと同じ組織の参加者に開始ダイアログが表示される。**誰でも会議中に停止できる**。ホストが設定を OFF にすると接続が切れる。
- 参加者側の要件: モバイルの Meet アプリは Android 309 以上、iOS 308 以上。サードパーティ製の Meet ハードウェアは対象外。
- 管理者設定: 管理コンソールで「アプリ > Google Workspace > Google Meet > Meet Media API」から有効化する。対応エディションは Business Starter / Standard / Plus、Enterprise Standard / Plus、Frontline、Essentials 系、G Suite Basic。Education は記載なし。
- ブレイクアウトルームには対応しない (Recall.ai のドキュメントによる)。
- **遅延**: 公式の数値はない (**未確認**)。WebRTC の SFU 経由なので、一般には数百 ms 以下と考えられる。

### 3.6 参照クライアント (GitHub)

- リポジトリ: `googleworkspace/meet-media-api-samples` (Apache-2.0。アーカイブされておらず、最終 push は 2026-10-26)。
  - `web/`: TypeScript 参照クライアント。`web/internal` に `meetmediaapiclient_impl.ts` と、チャネルごとのハンドラ (`session_control`、`media_stats`、`participants`、`media_entries`、`video_assignment`) がある。`web/types` に型定義がある。
  - `cpp/`: C++ 参照クライアント (Bazel、libwebrtc)。2026-09〜10 にも `OnAudio` コールバックや `MediaApiAudioDeviceModule` の修正が続いている。
- **npm パッケージ**: 公式の Media API クライアントは npm で見つからなかった (2026-10-27 の npm 検索)。サンプルの `web/samples/package.json` は `express`、`ts-loader`、`typescript`、`webpack` だけを使う。REST API 用の `@google-apps/meet` (0.11.0) が v2beta の `connectActiveConference` を含むかは**未確認**。
- TS クライアントの主な API: `MeetMediaApiClient` (`joinMeeting()`、`leaveMeeting()`、`createMediaLayout()`、`applyLayout()`、サブスクライブ可能な `participants` / `meetStreamTracks` / `mediaEntries` / `sessionStatus`)。設定は `MeetMediaClientRequiredConfiguration { accessToken, meetingSpaceId, numberOfVideoStreams, enableAudioStreams, logsCallback }`。
- **実行環境**:
  - TS サンプルは**ブラウザ専用** (Chrome 94 以上)。CORS の都合で `localhost` では動かず、App Engine へのデプロイが前提。OAuth は implicit grant を使う。
  - **サーバー側 (Node.js) で動かす場合**: 公式の対応は C++ クライアントだけ。Node では `@roamhq/wrtc` (0.10.0、libwebrtc ベース) か `werift` (0.25.2、純 TS) で SDP、データチャネル、CSRC を扱うことになる。Meet サーバーとの相互接続 (ヘッダー拡張、指標の送信、映像コーデックの申告) は**未確認**。動作実績も見つからなかった。

### 3.7 補足: Meet REST API (v2) と Workspace Events のリアルタイム性

- **文字起こしと録画は会議後に取得するもの。** 文字起こし ID は「transcript data が生成されたあと」に取れる。全員が退室すると文字起こしは自動で止まる。`transcriptEntries` は会議終了後 30 日間取得できる。逐次の文字起こしストリームはない。
- **会議中に取れるもの**:
  - `conferenceRecords.participants.list` (filter `latest_end_time IS NULL`) で、現在の参加者と `signedinUser` / `anonymousUser` / `phoneUser` の `displayName` が取れる。会議スペースの所有者か参加者なら呼べる。
  - Workspace Events API (Pub/Sub) のイベント:
    - `google.workspace.meet.conference.v2.started` / `.ended`
    - `google.workspace.meet.participant.v2.joined` / `.left`
    - `recording`、`transcript`、`smartNote` の `started` / `ended` / `fileGenerated`
- **使いどころ**: ブラウザキャプチャ方式 (MVP) で、話者分離ラベル (S1, S2…) に付ける**名前候補のリスト**として使う。音声そのものは取れない。

---

## 4. Meet Add-ons SDK

### 4.1 できること、できないこと

- **状態**: Web 版の SDK は 2024-09-09 に GA。個人の Google アカウントでも使える (2024-09 の Workspace Updates)。ヘルプには「パソコンでもモバイルでも使える」とあるが、アドオンによっては一部のプラットフォームで動かない。
- **サイドパネル**: 右側の縦長パネル。アドオンを開いた本人だけが見る (設定、サインイン、ホスト用の操作に使う)。
- **メインステージ**: 中央の大きな領域。`startActivity()` でアクティビティを始めると、**他の参加者に「アクティビティ進行中」の通知**が出る。
  - アドオンを入れている人は「参加」できる。
  - 入れていない人は「インストールして参加」に誘導される。
  - そのプラットフォームでは使えない人には「この端末では参加できない」と表示される。
  - 参加した人は**自分の iframe でアドオンを読み込む**。つまり画面共有ではなく、各自が操作できる。
- **音声、映像、参加者リストへのアクセスはない。** SDK の公開メンバーは次のとおり。
  - `MeetAddonClient`: `closeAddon`、`endActivity`、`getActivityStartingState`、`getFrameOpenReason`、`getMeetingInfo`、`on`、`setActivityStartingState`、`startActivity`
  - `MeetSidePanelClient`: `notifyMainStage`
  - `MeetMainStageClient`: `notifySidePanel`、`loadSidePanel`、`unloadSidePanel`
  - `MeetingInfo`: `meetingId`、`meetingCode`
- iframe 内で `getUserMedia` や `getDisplayMedia` が使えるか (Meet が iframe の `allow` 属性で `microphone` や `display-capture` を許可しているか) は、公式ドキュメントに記載がない (**未確認**)。開発者フォーラムには「iframe で getUserMedia が使えない」という報告がある。
- **Co-Doing API** (`createCoDoingClient`、`broadcastStateUpdate`) は Early Access Program で、**新規登録は終了**している。状態の同期は**自前のバックエンド** (既存の `Apps/Server/Src/Sync`) で行う。公式も「Handle it yourself by authoring your own synchronization backend」としている。
- **ブロックされる条件**: Google アカウントで未ログイン、管理者によるブロック、Family Link、閲覧専用ロール、クライアントサイド暗号化の会議、ライブストリーム、年齢制限。ホストは参加者がアクティビティを始められないように設定できる。

### 4.2 キャンバスを全員に見せる方法

```ts
// SidePanel.vue (script) — host starts the shared canvas activity for everyone in the call.
import { meet } from '@googleworkspace/meet-addons/meet.addons'

const session = await meet.addon.createAddonSession({ cloudProjectNumber: CLOUD_PROJECT_NUMBER })
const sidePanelClient = await session.createSidePanelClient()
const { meetingId, meetingCode } = await sidePanelClient.getMeetingInfo()
// Room join token is passed via additionalData (< 4,096 chars); URLs must be < 512 chars.
await sidePanelClient.startActivity({
  mainStageUrl: `https://app.example.com/meet/stage?room=${roomId}`,
  additionalData: JSON.stringify({ roomId, joinToken }),
})

// MainStage.vue (script) — every joiner loads the canvas and connects to our sync backend.
const stageClient = await session.createMainStageClient()
const { additionalData } = await stageClient.getActivityStartingState()
```

- 公式は、参加者全員に事前の権限設定なしでアクセスさせるために、**一時アクセストークンを `additionalData` で渡す方法を推奨**している (Choose a content sharing method)。これは既存のルーム参加トークンとそのまま対応する。
- サイドパネルとメインステージの間の `notifyMainStage` / `notifySidePanel` は**同じ参加者のフレーム間だけ**で届き、送信は 1 回限り。参加者間の同期には使えない。
- **画面共有からの誘導**: キャンバスのページで `exposeToMeetWhenScreensharing({ cloudProjectNumber, mainStageUrl, sidePanelUrl, startActivityOnOpen: true, additionalData })` を呼んでおく。ホストがそのタブを Meet で「タブを共有」すると、他の参加者にアドオンのインストールや起動が促される。
- **チャットからの誘導**: アドオンに関連付けられたリンクを会議チャットに貼ると、自動でインストール (起動) カードが表示される。

### 4.3 必要なもの (デプロイと公開)

1. **Google Cloud プロジェクト**を作り、プロジェクト番号を控える (`cloudProjectNumber`)。
2. **Google Workspace Marketplace SDK** (「API」ではなく「SDK」のほう) と **Google Workspace add-ons API** を有効にする。
3. **HTTP デプロイメント** (推奨) を作成し、マニフェストを登録する。主なフィールドは次のとおり。
   - `addOns.common.logoUrl` (必須)
   - `addOns.meet.web.sidePanelUrl`
   - `addOns.meet.web.addOnOrigins` (iframe の `frame-src` になる。すべて https)
   - `addOns.meet.web.supportsScreenSharing` (任意)
   - `addOns.meet.web.logoUrl` / `darkModeLogoUrl` (任意)
   - メインステージの URL はマニフェストではなく `startActivity({ mainStageUrl })` で渡す。`sidePanelUrl`、`mainStageUrl`、`exposeToMeet...` の URL の origin は、すべて `addOnOrigins` に含まれている必要がある。
4. **テスト**: HTTP deployments タブで Install → meet.google.com の「アクティビティ」パネルに表示される。
5. **npm**: `@googleworkspace/meet-addons` (latest 1.2.0)。import 元は `@googleworkspace/meet-addons/meet.addons`。CDN 版は `https://www.gstatic.com/meetjs/addons/1.1.0/meet.addons.js`。`createAddonSession()` はコンテンツの読み込みが終わってから呼ぶ。
6. **公開**:
   - **ドメイン内の非公開公開**は Google の審査なしで公開でき、自組織のユーザーだけが使える。ただし公開要件は満たしておくこと、と公式は書いている。
   - **一般公開**には審査がある。公開範囲はあとから変更できない。
   - Meet アドオンの主な審査要件 (about-app-review):
     - サードパーティ Cookie が無効でもログインと主要な操作が動くこと
     - 未ログイン時に **Google One Tap** と「Sign in with Google」を出すこと
     - レスポンシブで、iframe 内に横スクロールがないこと
     - メインステージを使うなら、複数人が同時に操作できる体験であること (キャンバスは該当する)
     - 開始フローのキャンセルに対応していること
     - サイドパネルでサインインとセットアップができること
     - **「The add-on must not provide functionality to invite a bot or rely on the presence of a bot in the meeting」**
   - OAuth スコープを使う場合は、Marketplace のアプリ構成と同意画面のスコープを完全に一致させる。

### 4.4 アーキテクチャ上の結論

- アドオンは**キャンバスの配布チャネル**として使い、音声は別の経路で取る。
- 公開版のアドオンには、ボットを呼ぶ機能を**載せない**。ボットを使うのは、Web アプリ本体 (Meet の外) の「録音設定」から管理者が明示的に有効にする場合に限る。それでも審査で「ボットに依存している」と判断されるリスクは残る (**要確認**)。アドオン単体でも、ホストのブラウザキャプチャで完全に機能するようにしておくこと。

---

## 5. ブラウザキャプチャ (Meet 用の MVP)

### 5.1 仕組み

- ホストが EkklesiazousAI のタブで「Meet の音声を取り込む」を押す → `getDisplayMedia` → Chrome のピッカーで **meet.google.com のタブ**を選び、「タブの音声も共有」を ON にする。
- **Meet タブの音声には、リモート参加者の声しか入らない。** Meet は自分のマイクの音をローカルで再生しないので、ホスト本人の声は含まれない。そこでホストのマイクを `getUserMedia` で**別ストリーム** (話者 = ホスト) として送る。サーバー側は既存の `onlineHostCapture` と同じで、ストリームごとに Soniox を使い、タブ側は話者分離 ON にする。

### 5.2 制約オプション (Chrome)

| オプション | 推奨値 | 理由 |
| --- | --- | --- |
| `video` | `{ displaySurface: 'browser', frameRate: 1 }` | 仕様上 `video:false` は TypeError になるので必須。フレームレートを下げて負荷を減らす |
| `audio` | `{ suppressLocalAudioPlayback: false, echoCancellation: false, noiseSuppression: false, autoGainControl: false }` | `suppressLocalAudioPlayback:true` にすると**ホストに Meet の音が聞こえなくなる**ので false にする。処理系は明示的に OFF にする (ASR 用) |
| `preferCurrentTab` | `false` (省略) | true だと**自分 (EkklesiazousAI) のタブ**が目立つ選択肢になる。取り込みたいのは別タブの Meet。`selfBrowserSurface:'exclude'` と同時に true にはできない |
| `selfBrowserSurface` | `'exclude'` | 自分のタブを選ばせない (Chrome 107 以降。既定値も exclude) |
| `surfaceSwitching` | `'include'` | 共有中に別タブへ切り替えられるようにする (Meet タブを選び直すときに便利) |
| `monitorTypeSurfaces` | `'exclude'` (Meet をタブで使う場合) | 画面全体の選択肢を隠し、誤選択を防ぐ (Chrome 119 以降)。Meet を PWA やウィンドウで使う人向けには `'include'` に戻す |
| `systemAudio` | `'exclude'` | 画面共有時のシステム音声を出さない。タブ音声は残る (Chrome 105 以降) |
| `windowAudio` | 省略 (または `'window'`) | Chrome 141 以降。ウィンドウ共有時の音声を「そのウィンドウだけ」にするヒント。Meet を PWA で使う場合の候補 (動作は**未確認**) |
| `controller` | `new CaptureController()` | 選択後に `setFocusBehavior('no-focus-change')` を呼ぶと、フォーカスを EkklesiazousAI 側に残せる (Conditional Focus。呼べるタイミングの細かい制約は**要確認**) |
| `restrictOwnAudio` | 参考 | 取り込む側のタブ自身が鳴らす音を除く。表示面にシステム音声がなければ効果はない。今回はタブ共有なので不要 |

```ts
// MeetTabCapture.ts — captures the remote-participant mix from a meet.google.com tab.
const controller = typeof CaptureController !== 'undefined' ? new CaptureController() : undefined
const tabStream = await navigator.mediaDevices.getDisplayMedia({
  video: { displaySurface: 'browser', frameRate: 1 },
  audio: {
    suppressLocalAudioPlayback: false,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  monitorTypeSurfaces: 'exclude',
  systemAudio: 'exclude',
  controller,
} as DisplayMediaStreamOptions)
controller?.setFocusBehavior?.('no-focus-change')

// the user may have unchecked "Also share tab audio" or picked a non-tab surface
if (tabStream.getAudioTracks().length === 0) throw new Error('tabAudioMissing')
const surface = tabStream.getVideoTracks()[0]?.getSettings().displaySurface // expect 'browser'
```

### 5.3 対応環境

- **タブ音声**は、Chromium 系のデスクトップ版ブラウザ (Chrome / Edge) なら Windows、macOS、Linux、ChromeOS のすべてで取れる (Chrome 74 以降。二次情報。MDN は「ブラウザや OS により異なる」とだけ書いている)。ピッカーの「Chrome タブ」ペインで「タブの音声も共有」を選ぶ。既定で ON とされるが、UI の文言や既定値は Chrome のバージョンで違う (**要確認**)。
- **Firefox と Safari ではタブ音声を取れない**ものとして扱う。モバイルブラウザは `getDisplayMedia` に対応していない。
- 呼び出しには**ユーザー操作 (transient activation)** と HTTPS が必要。
- Meet を **PWA (別ウィンドウ)** で使っている場合はタブとして選べない。ウィンドウ共有 + `windowAudio` (Chrome 141 以降) で取れるかは**未確認**。運用上は「Meet を通常のタブで開く」を案内する。
- 映像トラックを `stop()` したときに音声トラックが続くかどうかは**要確認**。低フレームレートで生かしておくのが安全。

### 5.4 エコーと重複の対策

- ホストが**スピーカー**で聞いていると、リモート参加者の声がホストのマイクに回り込む。すると同じ発話が「タブ音声 (話者分離ラベル)」と「ホストのマイク (ホスト名)」で**二重に文字起こしされる**。
- Meet 自身のエコーキャンセル (AEC) が効くのは、Meet が取ったマイク入力だけ。EkklesiazousAI が別に開いたマイクで、Chrome の AEC が **Meet タブの再生音を参照信号として除去できるかは未確認**。
- **対策 (優先順)**:
  1. **ヘッドホンを必須にする** (UI で確認を求める)。
  2. マイク側は `echoCancellation: true` にする (効く可能性はある)。
  3. サーバーで重複を除く: 時刻がほぼ同じ (±1 秒程度) で文字列がよく似た確定セグメントは、エネルギーの大きいほうだけ残す (既存ノート §3.5 の方式)。
  4. ホストの声だけは Meet 側のミュート状態と連動できない (DOM を読めないため)。アプリ内のミュートボタンと VAD で代用する。
- **名前付け**: 話者分離ラベルと名前の対応付けは UI で行う。名前候補は REST API の参加者リスト (§3.7) から出す。ラベルに 1 回名前を付けたら会議中は保持する。

---

## 6. サードパーティ Bot

### 6.1 Recall.ai

- **方式**: ボットがヘッドレスの Meet クライアントとして入室し、参加者ごとの音声を WebSocket で配信する。
- **設定**: `recording_config.audio_separate_raw = {}` と、`realtime_endpoints: [{ "type": "websocket", "url": "wss://...", "events": ["audio_separate_raw.data"] }]` を指定する。
- **受信データ**: イベント `audio_separate_raw.data` の `data.data` に次が入る。
  - `buffer`: base64。**16 kHz mono S16LE** で、Soniox にそのまま流せる。
  - `timestamp { absolute, relative }`
  - `participant { id, name, is_host, platform, email, extra_data }`
- **制約**:
  - Zoom / Teams / Meet いずれも**同時に最大 16 人の発話者**まで (公式は「loudest speakers」と表記)。
  - 画面共有の音声はリアルタイムでは取れない。
  - ミュート中の参加者は音声なし。ミュートしていない無音の参加者は空パケットを送ってくる。
- **入室**:
  - 既定では**匿名ユーザーとして入室を申請**し、ホストの承認が必要になる。招待されたメールアドレスで**サインインしたボット (Signed-In Bots)** なら待合室を飛ばせることがある。ただしホストの待合室設定には従う。主催者が不在で共同ホストもいないと、誰も承認できない。
  - **2026-03-24 以降**、Meet に **Safeguarded guest admit flow** が導入された。招待されていない、または検証できない参加申請は「要注意」キューに入り、**既定の操作が拒否**になる。ボットが「potential risk」と表示される事例がベンダー各社から報告されている。ホストが明示的に承認する運用が必要。
- **料金**:
  - 従量課金で **$0.50/時** (秒単位で按分。参加者数に依存しない)。
  - 内蔵の文字起こしは $0.15/時。ストレージは 7 日間無料。最初の 5 時間は無料。
  - 4 コアのボットは +$0.10/時。参加者別音声は計算負荷が高く、4 コアを推奨するという記述がある (検索要約による。本文では**未確認**)。
- **Meeting Direct Connect (Google Meet Media API)**: `POST /api/v1/meeting_direct_connect` に `google_meet_media_api { space_name, access_token }` を渡す方式。Media API の前提 (全参加者の Developer Preview 登録、関連性の高い 3 人まで) をそのまま引き継ぐので、今回は使えない。

### 6.2 Attendee (attendee-labs/attendee)

- ライセンスは **Elastic License 2.0** (OSI 準拠のオープンソースではない。自社内での利用や自前運用は可能だが、マネージドサービスとして第三者に提供することは制限される)。Django アプリを Docker イメージ 1 つで動かし、Postgres と Redis が必要。
- `websocket_settings.per_participant_audio = { url, sample_rate: 8000 | 16000 }` で、`trigger: "realtime_audio.per_participant"`、`data { participant_uuid, chunk (base64 PCM16 mono), sample_rate, timestamp_ms }` が届く。名前は `participant_events.join_leave` Webhook で引く。Google Meet でもテスト済み (`test_google_meet_bot.py`)。
- Meet ボットは、Chrome 上で Meet を動かし、ページ内で streamId とデバイスとユーザーを対応付けて参加者を判別する (`google_meet_chromedriver_payload.js`)。Meet の UI が変わると壊れるリスクがある。
- ホスト版は最初の 5 時間が無料で、その後 $0.50/時 (大口で $0.35/時まで割引)。自前運用のサポートは Enterprise 契約。

### 6.3 Meeting BaaS

- トークン制で、1 トークン = 1 時間。トークンパックの価格は $0.50〜$0.35/トークン。
  - 録画のみ: 1.00 トークン/時 (話者分離込み)
  - 文字起こし (Gladia): +0.25 トークン/時
  - ストリーミング: +0.10 トークン/時 (入力または出力ごと) と書かれている箇所と、+0.20 トークン/時 と書かれている箇所があり、ページ内で食い違っている
  - 入室待ちの時間も課金される
- 月額プラン: $0 / $99 / $199 / $299。上位ほど 1 日あたりのボット数が増える。
- 参加者ごとのリアルタイム音声に対応しているかは**未確認**。

### 6.4 ボット方式の共通の注意

- 参加者一覧にボットが見える。プライバシーの観点から、録音中であることを会議の冒頭で告知する運用が必要。
- 2026 年は Meet の入室承認フローが厳しくなっている (§6.1)。初回はホストへの案内が必須。
- 参加者別ストリームを全部 Soniox に流すと、ASR 費用が人数に比例して増える。参加者ごとに VAD をかけ、無音のときは送らない (またはストリームを閉じる) こと。

---

## 7. 推奨

### 7.1 MVP: ブラウザキャプチャ (追加承認なし、すぐ実装できる)

**構成**: `meetingPlatform: 'googleMeet'` + `captureMode: 'onlineHostCapture'` (既存の型と AudioGateway をそのまま使う)。

**必要なもの**:
1. ホストは**デスクトップ版の Chrome または Edge** で Meet を**通常のタブ**で開く (PWA は不可)。
2. EkklesiazousAI (HTTPS) のボタン操作から §5.2 の `getDisplayMedia` を呼ぶ。`getAudioTracks().length === 0` なら「タブの音声も共有」を ON にして選び直すよう案内する。
3. ホストのマイクは `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })` で取り、`speakerName = ホスト名` の別ストリームにする。
4. 両ストリームを既存の AudioWorklet で 16 kHz PCM16 mono にして `/ws/audio/:roomId` に送る。Soniox はタブ側だけ話者分離を ON にする。
5. **ヘッドホンの使用を必須**とし、UI で確認する。加えてサーバーで重複除去を行う (§5.4)。
6. (任意) ホストが Google OAuth で `https://www.googleapis.com/auth/meetings.space.readonly` に同意し (Meet REST API を有効化した Cloud プロジェクトが必要)、`conferenceRecords.participants.list` (filter `latest_end_time IS NULL`) で参加者名の候補を出す。話者分離ラベルへの名前付けは UI で行う。
7. キャンバスは、参加者に Meet チャットで URL を貼って配る。

### 7.2 本番 A: Meet アドオンでキャンバスを配る (GA の機能だけで作れる)

**必要なもの**:
1. Google Cloud プロジェクト (プロジェクト番号)。Workspace の組織が所有するのが望ましい。
2. **Google Workspace Marketplace SDK** と **Google Workspace add-ons API** を有効にする。HTTP デプロイメントのマニフェストには `addOns.common.logoUrl`、`addOns.meet.web.sidePanelUrl`、`addOns.meet.web.addOnOrigins` (すべて https) を記載する。
3. クライアントに `@googleworkspace/meet-addons` (1.2.0) を入れ、Vue の SFC を 2 つ追加する。サイドパネル (`MeetSidePanel.vue`: サインイン、ルーム作成、`startActivity`) と、メインステージ (`MeetMainStage.vue`: キャンバス本体) とする。
4. `startActivity({ mainStageUrl (< 512 文字), additionalData: JSON.stringify({ roomId, joinToken }) (< 4,096 文字) })`。参加者は `getActivityStartingState()` でトークンを受け取り、**既存の Sync バックエンド**につなぐ (Co-Doing API は登録終了のため使わない)。
5. 認証は **Google One Tap** と Sign in with Google にし、サードパーティ Cookie なしで動くようにする (トークンは URL か `additionalData` で渡す)。レスポンシブにし、iframe 内に横スクロールを出さない。
6. 音声はアドオンの iframe では取れない前提で設計する。ホストは §7.1 のキャプチャを**別タブの EkklesiazousAI**で実行する。アドオンの iframe 内で `getDisplayMedia({ preferCurrentTab: true })` を使って Meet タブ自身を取り込めるかは**未確認**。`document.featurePolicy?.allowsFeature('display-capture')` などで検証する価値はある。
7. まず**ドメイン内の非公開公開** (審査なし) で社内検証し、そのあと一般公開の審査を受ける。一般公開版にはボット招待の機能を入れない。
8. (任意) キャンバスのページで `exposeToMeetWhenScreensharing()` を呼び、タブ共有からアドオンへ誘導する。

### 7.3 本番 B: 参加者ごとに名前付きの音声 (ボット)

**必要なもの (Recall.ai)**:
1. Recall.ai の API キーとリージョンのエンドポイント。サーバーに `MeetBotGateway` (`ZoomRtmsGateway` と同じ構成) を追加し、新しい CaptureMode を作る (例: `meetingBot`)。
2. ボットを作るときに `recording_config.audio_separate_raw = {}` と `realtime_endpoints: [{ type: 'websocket', url: 'wss://<public-host>/ws/recall/:roomId', events: ['audio_separate_raw.data'] }]` を指定する。受信用 WebSocket は公開 HTTPS (wss) にし、ルームごとにトークンで認証する。
3. `participant.id` ごとに Soniox ストリームを開く (話者分離は OFF にし、`participant.name` を話者にする)。base64 をデコードすると S16LE 16 kHz mono になるので、変換はいらない。VAD で無音時は送らない。
4. 運用: ホストがボットの入室を承認する (Safeguarded admit flow)。可能なら招待メールに含まれるアカウントで**サインインしたボット**にする。会議の冒頭で録音していることを告知する。
5. 費用の目安は 1 会議 1 時間あたり **Recall $0.50 + Soniox (約 $0.12 × 発話中のストリーム数)**。
6. 自前で運用したい、または費用を下げたい場合は **Attendee** (ELv2、Docker + Postgres + Redis) の `per_participant_audio` に置き換えられる。音声ソースのアダプタを抽象化しておくこと。

### 7.4 将来: Meet Media API (GA を待つ)

- GA になったら (または登録が再開されたら) 判断し直す。ボットが見えず、名前付きで、ホスト組織の同意で動くので、Workspace 顧客向けには最も筋がよい。
- 実装方針は次のとおり。
  - ホストのブラウザで TS 参照クライアントを動かし、`MediaStreamTrack` を AudioWorklet で PCM16 にしてサーバーへ送る。そのとき CSRC から引いた参加者名を付ける。
  - または、サーバーで C++ クライアントを動かす (Node から使えるかは**未確認**)。
  - 要件: 制限付きスコープの審査 (外部向けの場合)、管理者による有効化、暗号化や透かしのない会議であること、未成年がいないこと。

---

## 8. 参考文献

(括弧内はページの最終更新日。記載がないものは不明。)

### Google Meet Media API
- Overview (2026-10-01): https://developers.google.com/workspace/meet/media-api/guides/overview
- Get started (2026-10-01): https://developers.google.com/workspace/meet/media-api/guides/get-started
- Concepts (2026-10-01): https://developers.google.com/workspace/meet/media-api/guides/concepts
- Manage virtual streams: https://developers.google.com/workspace/meet/media-api/guides/virtual-streams
- TypeScript quickstart (2026-10-01): https://developers.google.com/workspace/meet/media-api/guides/ts
- `spaces.connectActiveConference` (2026-10-02): https://developers.google.com/workspace/meet/media-api/reference/rest/connectActiveConference
- 参照クライアント: https://github.com/googleworkspace/meet-media-api-samples (`web/types/datachannels.d.ts`、`web/internal/meetmediaapiclient_impl.ts`、`cpp/api/media_api_client_interface.h`)
- 旧版 overview (Wayback、2025-10-13 版 / 2026-09-03 版): https://web.archive.org/web/2026/https://developers.google.com/workspace/meet/media-api/guides/overview
- 管理者向けヘルプ: Media API へのアクセスを管理する (2026-10-22): https://knowledge.workspace.google.com/admin/meet/control-media-api-access-in-google-meet
- リリースノート: https://developers.google.com/workspace/meet/release-notes
- Restricted scope verification (2026-08-19): https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- 開発者フォーラムの質問 (2026-07-27、回答なし): https://discuss.google.dev/t/how-can-a-public-google-meet-add-on-access-real-time-participant-audio-without-a-bot/385365

### Google Meet REST API / Events
- Work with artifacts (2026-09-14): https://developers.google.com/workspace/meet/api/guides/artifacts
- Work with participants (2026-09-14): https://developers.google.com/workspace/meet/api/guides/participants
- Subscribe to Google Meet events (2026-09-03): https://developers.google.com/workspace/events/guides/events-meet

### Google Meet Add-ons SDK
- Overview (2026-09-03): https://developers.google.com/workspace/meet/add-ons/guides/overview
- Quickstart: https://developers.google.com/workspace/meet/add-ons/guides/quickstart
- Deploy: https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on
- Collaborate using an add-on: https://developers.google.com/workspace/meet/add-ons/guides/collaborate-in-the-add-on
- Frame-to-frame messaging: https://developers.google.com/workspace/meet/add-ons/guides/frame-to-frame-messaging
- Co-Doing API (EAP、新規登録終了): https://developers.google.com/workspace/meet/add-ons/guides/use-CoDoingAPI
- Promote (exposeToMeetWhenScreensharing): https://developers.google.com/workspace/meet/add-ons/guides/promote
- Add-on security: https://developers.google.com/workspace/meet/add-ons/guides/add-on-security
- Content sharing method: https://developers.google.com/workspace/meet/add-ons/guides/content-sharing-method
- SDK リファレンス (2025-03-27): https://developers.google.com/workspace/meet/add-ons/reference/websdk/addon_sdk
- ActivityStartingState: https://developers.google.com/workspace/meet/add-ons/reference/websdk/addon_sdk.activitystartingstate
- Publish: https://developers.google.com/workspace/meet/add-ons/guides/publish
- Marketplace の審査要件 (Meet add-ons 節、2026-09-03): https://developers.google.com/workspace/marketplace/about-app-review
- Meet ヘルプ: アドオンを使う: https://support.google.com/meet/answer/13961388
- GA 告知 (2024-09): https://workspaceupdates.googleblog.com/2024/09/google-meet-add-ons-sdk-is-now-available.html
- npm: https://www.npmjs.com/package/@googleworkspace/meet-addons

### ブラウザキャプチャ
- MDN getDisplayMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- MDN suppressLocalAudioPlayback: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/suppressLocalAudioPlayback
- MDN restrictOwnAudio: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/restrictOwnAudio
- Chrome Screen sharing controls: https://developer.chrome.com/docs/web-platform/screen-sharing-controls
- macOS の Chrome でシステム音声 (Addpipe、2026-02-19): https://blog.addpipe.com/getdisplaymedia-allows-capturing-the-screen-with-system-sounds-on-chrome-on-macos/
- Addpipe getDisplayMedia デモ (プラットフォーム別の音声対応): https://addpipe.com/getdisplaymedia-demo/

### サードパーティ Bot / Meet の入室フロー
- Recall.ai 料金: https://www.recall.ai/pricing
- Recall.ai 参加者別音声 (リアルタイム、2026-10-18): https://docs.recall.ai/docs/how-to-get-separate-audio-per-participant-realtime
- Recall.ai Google Meet Media API (2026-04-17): https://docs.recall.ai/docs/google-meet-media-api
- Recall.ai Signed-In Bots (Google Meet): https://docs.recall.ai/docs/google-meet-login-getting-started
- Recall.ai 待合室のトラブルシューティング: https://docs.recall.ai/docs/troubleshooting-google-meet-waiting-room
- Attendee: https://github.com/attendee-labs/attendee (`docs/realtime_audio.md`、LICENSE = ELv2)
- Attendee 料金: https://attendee.dev/pricing
- Meeting BaaS 料金: https://www.meetingbaas.com/en/pricing
- Safeguarded guest admit flow (Workspace Updates、2026-02): https://workspaceupdates.googleblog.com/2026/02/safeguarded-guest-admit-flow-in-google-meet.html

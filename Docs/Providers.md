# Providers and configuration

[日本語](Providers.ja.md)

All keys go in `.env` at the repository root (see `.env.example`) and stay on the server. The server picks providers at start-up; `GET /api/config` and the lobby footer show what is active. Without an Anthropic key, the server runs in **mock mode**: a scripted responder replaces the language models and demo sources replace search, so the whole pipeline (routing, admission, delivery, layers, issue map, clarifications) still runs.

## Speech recognition

| Role     | Provider                                                 | Why                                                                                                                                                                                          |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default  | **Soniox** (`stt-rt-v5`)                                 | One model for Japanese and English with code-switching inside a stream, a language label on every token, real-time speaker diarization, and endpoint detection. About $0.12 per stream-hour. |
| Fallback | **AssemblyAI** Universal Streaming (`universal-3-6-pro`) | Japanese support, code-switching, streaming speaker labels, about 150 ms partials. About $0.45/h plus speaker labels.                                                                        |

Both are used over raw WebSockets (`Apps/Server/Src/Speech`). Audio is 16 kHz mono PCM16, sent in 40 ms frames. Glossary terms and wake words are passed to the recognizer as vocabulary context.

Not chosen as the default: Google Chirp, OpenAI and ElevenLabs realtime (no real-time diarization), Azure (continuous language ID cannot switch languages mid-sentence), Speechmatics (no Japanese–English bilingual model).

No independent benchmark of Japanese character error rate exists for these services; the vendor figures are English. Evaluate on your own mixed Japanese/English recordings before relying on one. The research note describes the procedure.

## Language models

| Role   | Default                                                                                                                                                    | Settings                                                                     | Used for                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Router | Cerebras `gpt-oss-120b` (or Groq `openai/gpt-oss-20b`), **hedged** with Claude Haiku 5.5 after 450 ms; Claude Haiku 5.5 alone when no fast host key is set | Strict JSON schema, low reasoning effort                                     | Deciding from live speech what to research (trigger detection), and interpreting explicit commands |
| Writer | `claude-haiku-5-5`                                                                                                                                         | Structured outputs, streaming, thinking off, effort `low`                    | Gists, details, private clarifications and recaps, rewriting anonymous concerns                    |
| Deep   | `claude-opus-5-5`                                                                                                                                          | Structured outputs, streaming, effort `medium`, server-side refusal fallback | Issue map and rolling summary, deep-research planning and writing                                  |

Latency techniques:

- **Hedged router:** the fastest host answers; if it is slow or fails, Claude takes over. The Japanese accuracy of gpt-oss on meeting speech is unverified, which is the other reason for the hedge.
- **Speculative routing:** interim speech is analyzed once it has grown by 30 characters, so cards often appear before the speaker finishes.
- **Streaming partial JSON:** gist text appears word by word.
- **Prompt caching:** system prompts are byte-stable, and the transcript is rendered as fixed chunks of 20 utterances, with a cache breakpoint on the last complete chunk, so repeated calls reuse the cached prefix.
- **Priorities:** explicit requests overtake proactive research; hover prefetches run only when a slot is free.

Change models with `MODEL_WRITER` and `MODEL_DEEP`, and the router with `ROUTER_PROVIDER` (`auto`, `anthropic`, `cerebras`, `groq`) and `ROUTER_HEDGE`.

## Search

| Provider          | Category                      | Key                                                          |
| ----------------- | ----------------------------- | ------------------------------------------------------------ |
| Parallel Search   | Web                           | `PARALLEL_API_KEY`                                           |
| Exa               | Web                           | `EXA_API_KEY`                                                |
| OpenAlex          | Papers (English and Japanese) | Free; `OPENALEX_API_KEY` / `OPENALEX_EMAIL` optional         |
| Semantic Scholar  | Papers                        | `SEMANTIC_SCHOLAR_API_KEY` (limited to 1 request per second) |
| Wikipedia (ja/en) | Encyclopedia                  | Free                                                         |

Research depth tiers:

| Depth    | Search                                                                                  | Deadline | Writing                       |
| -------- | --------------------------------------------------------------------------------------- | -------- | ----------------------------- |
| Quick    | Web providers raced (first useful answer wins); Wikipedia for catch-up cards            | 1.8 s    | Gist only (detail on demand)  |
| Standard | Japanese and English queries fanned out over web providers, plus papers or encyclopedia | 2.8 s    | Gist + detail                 |
| Deep     | The deep model plans 3–5 sub-queries; thorough web modes plus papers                    | 9 s      | Gist + detail + deep sections |

Proactive cards use the room's default depth (Settings → Room). Explicit commands use the depth chosen in the command bar, or one inferred from wording such as "quickly" or 「詳しく」.

## Meeting integrations

- **Zoom RTMS:** `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, `PUBLIC_BASE_URL`.
- **Meeting bot (Recall.ai, experimental):** `RECALL_API_KEY`, `RECALL_API_BASE_URL`, `MEETING_BOT_NAME`, `PUBLIC_BASE_URL` (must be reachable over HTTPS).
- **Google Meet add-on:** `VITE_MEET_CLOUD_PROJECT_NUMBER`.

See [MeetingPlatforms.md](MeetingPlatforms.md) for setup.

# EkklesiazousAI

Ἐκκλησιάζουσαι (Ekklesiazousai) = Hidden one sneaks into ἐκκλησία (ekklesia; call-out assembly)

[日本語](README.ja.md)

## What it does

EkklesiazousAI listens to a meeting — in person with one room microphone, or online on Google Meet, Zoom or Teams — in Japanese, English or both, and quietly researches what people talk about. Results appear within seconds on a shared, Miro-like infinite canvas that every participant opens on their own device.

Live speech moves on before anyone can look things up. That is how groups reinvent the wheel, talk past each other and agree too quickly. The agent compensates:

- **Prior art** — when someone proposes to build something, existing products, papers and methods appear.
- **Catch-up** — unfamiliar terms, papers and cases are explained, and collected in a shared glossary.
- **Evidence** — factual claims and anchoring numbers are checked against sources.
- **Challenges** — when the group converges too fast, the agent asks evidence-based questions (devil's advocate).
- **Issue map** — questions, ideas, pros, cons and decisions are mapped (IBIS), with a rolling summary.
- **Private help** — one click on a transcript line (or the `?` key) explains it only to you; several people asking about the same moment produces an anonymous card for everyone.
- **Anonymous dissent** — type a concern and the agent raises it as its own.
- **Explicit requests** — type, or say "Hey Ekklesia, look up …", with adjustable research depth (quick / standard / deep).

Every card starts as a one-line gist; details and deep research are generated only when someone opens them. Presentation is switchable per hypothesis (timeline rail, topic islands, issue map, calm periphery, shared spotlight, delivery timing, …) with interaction logging for UX studies.

## Setup (first time)

Requirements: Node.js 22+ and pnpm 10.

```bash
git clone https://github.com/konbraphat51/EkklesiazousAI.git
cd EkklesiazousAI
pnpm install
cp .env.example .env   # optional: add API keys (without keys, demo mode runs)
pnpm dev
```

Open http://localhost:5173 and click **Start demo meeting** — a scripted bilingual meeting runs with mock AI, no keys needed.

For live meetings add at least `SONIOX_API_KEY` (speech) and `ANTHROPIC_API_KEY` (AI) to `.env`; search keys (`PARALLEL_API_KEY`, `EXA_API_KEY`) improve results. See [Docs/Providers.md](Docs/Providers.md).

## Running again

```bash
pnpm dev                 # development: server on :8787, client on :5173 (hot reload)
```

or as a single production server:

```bash
pnpm build
pnpm start               # serves the built client and the API on http://localhost:8787
```

Participants on other devices open the same room URL (use `HOST=0.0.0.0` and your machine's address, or a tunnel such as ngrok for online meetings).

## Important commands

| Command                     | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                  | Run server and client with hot reload                             |
| `pnpm demo`                 | Same, forcing mock AI providers (no API calls even if keys exist) |
| `pnpm build`                | Type-check everything and build the client                        |
| `pnpm start`                | Run the production server (serves `Apps/Client/dist`)             |
| `pnpm test`                 | Run all unit and integration tests                                |
| `pnpm typecheck`            | Type-check all packages                                           |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                                 |

## Documentation

- [Docs/Architecture.md](Docs/Architecture.md) — components, data model, class and sequence diagrams, latency design
- [Docs/UxHypotheses.md](Docs/UxHypotheses.md) — presentation variants, the hypotheses behind them, running experiments
- [Docs/MeetingPlatforms.md](Docs/MeetingPlatforms.md) — in person, Google Meet, Zoom, Teams: capture options and setup
- [Docs/Providers.md](Docs/Providers.md) — speech, language-model and search providers, configuration
- [ResearchNotes/](ResearchNotes/) — research behind the design (Japanese)

## Project layout

```
Apps/Server      Node.js server: audio ingestion, speech recognition, agent pipeline, Yjs sync hub
Apps/Client      Vue 3 client: infinite canvas, transcript, private help, settings
Packages/Shared  Domain model, Yjs board schema and wire protocols shared by both
Docs             System documentation (English + Japanese)
ResearchNotes    Research notes
```

## License

MIT

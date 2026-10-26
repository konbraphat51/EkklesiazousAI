# CLAUDE.md v1.0.0

Check the newest version in [Gist](https://gist.github.com/konbraphat51/af909a374c59d306c2d2b3fd7788507e) every Monday (Last checked: 2026/10/26). If newer, replace `## User Requests` with the newest document and update the version number.

## User Requests
- Write SOLID, readable, and maintainable code
- Put system documents in `/Docs/`, research notes (if user ordered you to research) in `/ResearchNotes/`
- Write comments in English
  - Comments should be concise. Should be only single line per topic.
    - There is NO need to leave comments for each code update.
      - ex: "This code is left because of..."
      - ex: "This code is deleted because of..."
    - Be aware if the code readers would prefer to read your comments, or it is just noise for them.
  - Write comments for the responsibility of the file itself at the top
  - Write comments for each public class/method/variable
    - If Python, write in docstring format
    - If C#, write in XML format
    - If TypeScript, write in TSDoc format

```python:sample.py
def transcribe(
    self,
    all_pages: list[Image],
    blocker_result: BlockerResult,
) -> TranscriptionResult:
    """Transcribes every TEXT block of blocker_result, cropped from all_pages.

    Args:
        all_pages: Every page image, indexed by Block.page_number.
        blocker_result: The blocks detected by a Blocker, to be transcribed.
    """
    transcriptions: list[TranscriptionBlock] = []

    # for each block...
    for block in blocker_result.blocks:
        # ...OCR the block

        # if the block is not text...
        if block.block_type != BlockType.TEXT:
            # ...skip
            continue

        # image extraction
        block_image = self._extract_block_image(all_pages[block.page_number], block)

        # transcribe the block image
        text = self._ocr_block_image(block_image)
        transcriptions.append(TranscriptionBlock(block, text))

    return TranscriptionResult(transcriptions)
```

- Prepare English and Japanese versions for all system documents.
  - Make English version as the primary version, and Japanese version as the secondary version.
    - ex: `README.md` (English) and `README.ja.md` (Japanese)

- For research notes (if ordered), only either language is allowed. Match with the language of the user prompt.
  - Files in `/ResearchNotes` created by Claude must start from `YYYYMMDD_` prefix.
- all in-UI text should be in English by default, but support Japanese localization.
- Everytime updated the code, check all documents and update them if necessary.
- Debug the frontend by yourself
- Make granular commits for each unit of implementation. One commit per small, self-contained unit. Do not bundle a whole subsystem into one commit. Commit each unit as soon as its checks pass.
  - Set Angular Conventional commit message prefixes.
    - For update in `/ResearchNotes/`, set prefix as `resn:` 
- If you use Python
  - Use `uv` for package management
  - Enable strict typing
  - Add appropriate package for better code/quality
- If you use JavaScript/TypeScript
  - Use `pnpm` for package management
  - Add appropriate package for better code/quality
  - Use Vue for frontend
    - Granular components are preferred.
  - Write in Single File Component style, such as

```vue
<template>HTML</template>
<script>
export default {
  name:...
}
</script>
<style scoped></style>
```

- Write documents to understand the code architecture. Such as: class diagram, sequence diagram...
- In `/README.md`, write:
  - System Name as H1
  - Easy description of what system does
  - How to setup from `git clone`
  - How to run for second time and later
  - Important CLIs

- If API keys or other enviroment variables, read from `.env`
  - git ignore `.env`
  - create `.env.example`

### Naming Conventions

#### For All Languages
- Directory Names: UpperCamelCase
- File Names: UpperCamelCase
- Class Names: Must be Noun. Must be postpositive (ex: `AppleGreen`, not `GreenApple`)
- Function Names: Must be verb. Start from verb (ex: `EatApple()`, not `AppleEater()`)
- Variable Names: Basically noun, but follow general conventions (ex: `is` for booleans). Make it postpositive when noun.

#### For Python
- Class Names: UpperCamelCase
- Function Names: snake_case. Privates starts from `_`
- Variable Names: snake_case. Privates starts from `_`

#### For C#
- Class Names: UpperCamelCase
- Function Names: UpperCamelCase
- Variable Names: lowerCamelCase
- Property Names: lowerCamelCase
- Enum Names: UpperCamelCase

## Claude Notes
=Claude can freely edit below this line. Use this area to share project knowledge throught different chat sessions. Capture conventions, structure, commands, and gotchas so that agents joining later stay consistent with existing decisions.=

### Structure
- pnpm monorepo: `Apps/Server` (Node, run with `tsx`, no emit), `Apps/Client` (Vue 3 + Vite + Vue Flow), `Packages/Shared` (consumed as TS source via `exports: ./Src/Index.ts`).
- The shared Yjs document (`DocumentBoard` in Shared) is the single source of truth. Server-side code edits the same in-memory `Y.Doc` that browsers sync with (`Apps/Server/Src/Sync/SyncHub.ts`, a hand-written y-websocket server; `@y/websocket-server` needs a yjs 14 pre-release, so it is not used).
- Agent pipeline: `ConversationPulse` → `TriggerLoop` (router) → `InsightPolicy` → `DeliveryGate` → `InsightResearcher` (gist/detail/deep) — composed in `AgentRoom`. Prompts live in `Apps/Server/Src/Agent/Prompts`, output schemas in `AgentSchemas.ts`.
- Every UX presentation choice is a feature in `Packages/Shared/Src/Experiment/UxFeatures.ts` (first option = default). Adding one: register it there, add i18n keys `uxFeature.<id>.{name,options,hint}` in both locales, read it via `session.ux` (client) or `meta.uxSettings` (server), document it in `Docs/UxHypotheses*.md`.

### Conventions
- Naming follows "general → specific" (`SearchProviderExa`, `LayoutTimeline`, `CardInsight.vue`) — the Vue style-guide reading of the postpositive rule. Directories and source files are UpperCamelCase; tool configs keep their conventional names (`vite.config.ts`, `package.json`).
- Vue SFCs use `<script lang="ts">` + `defineComponent({ name, props, emits, setup })`.
- All LLM outputs are zod schemas with only required fields (strict-JSON hosts reject optional/`oneOf`); use `''`/`[]` for "absent".
- Every `LanguageModel.generate` call passes a `task` and `hints`; the mock model (`DemoResponder`) answers from hints, so keep hints meaningful when adding tasks.
- Private results (clarifications, private commands) must never be written to the board; they are streamed as NDJSON to the requester only.
- UI text: English default + Japanese in `Apps/Client/Src/Locales/{En,Ja}.json` (no `|` or `@` in messages — vue-i18n syntax).

### Commands
- `pnpm dev` (server :8787 + client :5173), `pnpm demo` (forces mock), `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm start`.
- Server alone in mock mode on another port: `cd Apps/Server && PORT=8899 npx tsx Src/Main.ts --mock`; client against it: `EKKLESIAZOUS_SERVER=http://localhost:8899 npx vite --port 5199`.

### Gotchas
- Prettier reformats long lines; scripted search-and-replace edits must match the formatted text (re-read before editing).
- Vitest swallows `console.log` in tests; write probe output to a file when debugging.
- When driving the UI with Playwright, issue waits and screenshots in separate turns — batched tool calls run concurrently and capture stale frames.
- Proactive cards are rate-limited per minute (`RATE_LIMITS_DEFAULT`); fast-forwarded demos/tests must lift the limits (`AgentRoomOptions`).
- `inject()` does not see a `provide()` from the same component: pass the session explicitly there (`useClarification(session)`).
- Commit with explicit paths, not `git add -A`: research agents may be writing `ResearchNotes/` concurrently, and notes need the `resn:` prefix.

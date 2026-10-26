# UX hypotheses and experiments

[日本語](UxHypotheses.ja.md)

Every presentation choice in EkklesiazousAI is a switchable _UX feature_. Each option embodies a testable hypothesis about how to present AI-found information during live talk without derailing it. The registry is in `Packages/Shared/Src/Experiment/UxFeatures.ts`; the background research is in [ResearchNotes/](../ResearchNotes/).

## The underlying problem

Live speech makes every act of knowledge work expensive in the moment:

- **Looking something up** costs time; the conversation moves on.
- **Admitting ignorance** costs face (help-seeking threat; Karabenick 2003).
- **Seeing the structure** costs attention; speech is transient.
- **Dissenting** costs social standing (groupthink; Janis 1972), and shared information dominates discussion (hidden profiles; Stasser & Titus 1985).

The system tries to push each of these costs toward zero: privately, at the right moment, and without hijacking attention. The research note on synchronous voice discussion shows that switching to text does not fix information pooling. So the design keeps voice for reaching agreement and uses the canvas for sharing facts, following media synchronicity theory.

## Features, options and hypotheses

Scope **P** means each participant can choose for themselves, unless the room is locked. Scope **R** means one value applies to the whole room. The first option is the default.

| Feature             | Scope | Options                                         | Hypothesis                                                                                                                                                                                                                                         |
| ------------------- | ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`            | P     | `timeline`, `topicMap`, `issueMap`, `periphery` | See the layouts table below.                                                                                                                                                                                                                       |
| `spotlight`         | R     | `manual`, `auto`, `off`                         | A card promoted to a shared centre frame creates joint attention; an agent promoting urgent items helps when nobody does, at the cost of interrupting more.                                                                                        |
| `disclosure`        | P     | `progressive`, `full`                           | A one-plain-sentence gist with details on click (Shneiderman 1996; Rhodes' "ramping interface") is faster to produce and lighter to read than full cards, without losing information people actually want.                                         |
| `deliveryTiming`    | R     | `breakpoint`, `immediate`, `digest`, `shadow`   | Showing non-urgent cards at a pause or a change of speaker interrupts less than showing them immediately (Iqbal & Bailey 2008). Digests trade timeliness for calm. `shadow` generates and logs cards without showing them, a baseline for studies. |
| `attentionCue`      | P     | `pulse`, `toast`, `autoPan`, `none`             | A brief glow is enough to notice new cards on a shared canvas. Toasts and moving the view are stronger but more disruptive (peripheral displays; Matthews et al. 2004).                                                                            |
| `critiqueFraming`   | R     | `question`, `statement`, `persona`              | Challenges asked as Socratic questions threaten face less than statements. A stakeholder voice makes dissent less personal. Evidence-based dissent beats role-played dissent (Nemeth et al. 2001).                                                 |
| `cardAging`         | P     | `fade`, `keep`                                  | Fading unpinned cards after 5 minutes reduces clutter without losing anything important.                                                                                                                                                           |
| `confusionMarks`    | R     | `visible`, `hidden`                             | Showing anonymous "?×n" counts on transcript lines helps speakers notice and fill knowledge gaps (Mudslide; Glassman et al. 2015) without exposing who asked.                                                                                      |
| `speakingBalance`   | R     | `hidden`, `visible`                             | An anonymous participation-equity meter nudges dominant speakers without naming anyone (meeting mediators).                                                                                                                                        |
| `sourceDisplay`     | P     | `inline`, `onDemand`                            | Visible sources improve trust calibration; hiding them until asked reduces clutter.                                                                                                                                                                |
| `requesterIdentity` | R     | `shown`, `hidden`                               | Showing who asked supports accountability; hiding it lowers the social cost of asking.                                                                                                                                                             |

### Layouts

| Layout             | Hypothesis                                                                                                                                                          | Main references                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Timeline rail**  | Hanging each card above the moment of the remark that triggered it makes it cheap to connect information to talk. Speaker lanes show who spoke when.                | Temporal anchoring in live captions and meeting tools (Visual Captions, CHI 2023; InsightToast, UIST 2026) |
| **Topic islands**  | Stable, per-topic clusters that never move on their own support spatial memory and show what has been covered and what is missing.                                  | Spatial hypertext (Marshall & Shipman 1995)                                                                |
| **Issue map**      | An explicit IBIS map of questions, ideas, pros, cons and decisions, with evidence and challenges attached as chips, counters circular talk and premature consensus. | IBIS (Kunz & Rittel 1970), dialogue mapping (Conklin 2006), EchoMind (CSCW 2025)                           |
| **Calm periphery** | Quiet edge trays keep the centre free; only urgent, recent items reach it. This minimizes interruption.                                                             | Calm technology (Weiser & Brown 1996), peripheral displays (Matthews 2007)                                 |

### Cross-cutting design principles

- **Gist first, with information scent:** every collapsed card shows its kind, source domains, a confidence meter and the fact-check verdict, so people can judge whether to open it.
- **Provenance on every card:** why it was raised, the triggering quote, its sources, and the latency ("appeared 1.2 s after the remark").
- **Stable layout:** the agent never moves an item a participant placed. Agent-made issue nodes carry a 🤖 mark until edited; after that the agent leaves them alone.
- **Private help flows to the shared board only with consent:** explanations are private by default and can be shared anonymously. Several people asking about the same moment promotes an anonymous card.
- **Rate limits:** nice-to-know proactive cards are capped per minute by proactivity (low 2, medium 3, high 6). Urgent items (urgency ≥ 0.8) and explicit requests are never capped.

## Running an experiment

1. Open **Settings → Experiment** and set the room-wide condition for every feature.
2. Tick **Lock participants to these settings** so nobody can switch condition.
3. Optionally set `deliveryTiming = shadow` for a baseline: the agent works and logs but shows nothing proactive.
4. Run the session. Interactions and pipeline events are written to `Apps/Server/Data/Logs/<roomId>.jsonl`.
5. Export the minutes with **Download minutes** (`GET /api/rooms/:roomId/minutes`) for content analysis.

### What is logged

| Source | Events                                                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent  | `router` (latency, speculative or not, proposals), `created`, `suppressed` (reason: kind disabled, below threshold, duplicate, rate-limited), `released` (latency), `shadowed`, `gistReady` (all timings), `layerRequested`, `layerReady`, `clarification`, `dissent`, `command`, `agentState` |
| Client | `sessionStarted`, `uxChanged`, `cardShown`, `cardHovered`, `cardExpanded`, `cardCollapsed`, `layerRequested`, `sourceOpened`, `cardVoted`, `cardPinned`, `cardDismissed`, `clarificationRequested`, `clarificationShared`, `commandIssued`, `dissentRaised`, `noteCreated`                     |

Each client event carries the participant's pseudonymous id and the participant's effective UX settings at that moment, so conditions can be reconstructed. Each insight on the board also carries its own timings: `utteranceAt`, `triggeredAt`, `firstContentAt`, `readyAt`, `releasedAt`, `detailRequestedAt`, `detailReadyAt`, `deepRequestedAt`, `deepReadyAt`, and `isSpeculative`.

Proposed studies, with their significance, design and required instrumentation, are in [ResearchNotes/20261027_HciResearchProposals.md](../ResearchNotes/20261027_HciResearchProposals.md). The recommended first step is a pilot that varies latency and progressive disclosure per card, which validates this logging.

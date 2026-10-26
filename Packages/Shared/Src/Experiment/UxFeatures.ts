// Registry of switchable UX features; every option embodies one UX hypothesis that can be A/B tested.

/**
 * Where a feature's option is decided.
 *
 * - `room`: one value for everybody (server-side behavior or shared display).
 * - `participant`: each viewer may override the room default, unless the room is locked.
 */
export type UxFeatureScope = 'room' | 'participant'

/** Static description of one feature. */
interface UxFeatureDefinition<Option extends string> {
  /** Allowed options; the first is the default. */
  options: readonly Option[]
  /** Where the option is decided. */
  scope: UxFeatureScope
}

function defineFeature<const Option extends string>(
  options: readonly Option[],
  scope: UxFeatureScope,
): UxFeatureDefinition<Option> {
  return { options, scope }
}

/**
 * Every switchable feature. Option semantics (hypotheses are documented in Docs/UxHypotheses.md):
 *
 * - `layout`: canvas arrangement — time-anchored rail, topic islands, IBIS issue map, or calm
 *   periphery (edge trays; only urgent items reach the centre).
 * - `spotlight`: a card promoted to a shared centre frame for joint attention — promoted `manual`ly
 *   by participants, also `auto`matically by the agent for urgent items, or `off`.
 * - `disclosure`: `progressive` shows a one-line gist and expands on click; `full` shows all at once.
 * - `deliveryTiming`: proactive cards appear `immediate`ly, at the next conversational `breakpoint`
 *   (pause or speaker change), batched into a periodic `digest`, or never (`shadow`: generated and
 *   logged only, as a research baseline).
 * - `attentionCue`: how a new card announces itself — `pulse` glow, `toast`, `autoPan`, or `none`.
 * - `critiqueFraming`: devil's-advocate output as a Socratic `question`, a `statement`, or a
 *   stakeholder `persona` voice.
 * - `cardAging`: older unpinned cards `fade` to reduce clutter, or are `kept` at full strength.
 * - `confusionMarks`: anonymous counts of private clarification requests on the transcript are
 *   `hidden` or `visible` to everyone.
 * - `speakingBalance`: a participation-equity meter is `hidden` or `visible`.
 * - `sourceDisplay`: sources are listed `inline` on expanded cards or only `onDemand`.
 * - `requesterIdentity`: names of participants who issued commands are `shown` or `hidden`.
 */
export const UX_FEATURES = {
  layout: defineFeature(['timeline', 'topicMap', 'issueMap', 'periphery'], 'participant'),
  spotlight: defineFeature(['manual', 'auto', 'off'], 'room'),
  disclosure: defineFeature(['progressive', 'full'], 'participant'),
  deliveryTiming: defineFeature(['breakpoint', 'immediate', 'digest', 'shadow'], 'room'),
  attentionCue: defineFeature(['pulse', 'toast', 'autoPan', 'none'], 'participant'),
  critiqueFraming: defineFeature(['question', 'statement', 'persona'], 'room'),
  cardAging: defineFeature(['fade', 'keep'], 'participant'),
  confusionMarks: defineFeature(['visible', 'hidden'], 'room'),
  speakingBalance: defineFeature(['hidden', 'visible'], 'room'),
  sourceDisplay: defineFeature(['inline', 'onDemand'], 'participant'),
  requesterIdentity: defineFeature(['shown', 'hidden'], 'room'),
} as const

/** Identifier of a switchable feature. */
export type UxFeatureId = keyof typeof UX_FEATURES

/** Option type of one feature. */
export type UxOption<Id extends UxFeatureId> = (typeof UX_FEATURES)[Id]['options'][number]

/** A complete assignment of options to features. */
export type UxSettings = { [Id in UxFeatureId]: UxOption<Id> }

/** Canvas layout identifier (the `layout` feature's options). */
export type LayoutId = UxOption<'layout'>

/** Every feature id, in settings-panel order. */
export const UX_FEATURE_IDS = Object.keys(UX_FEATURES) as UxFeatureId[]

/** Every layout id, in menu order. */
export const LAYOUT_IDS: readonly LayoutId[] = UX_FEATURES.layout.options

/** Builds the default settings (first option of every feature). */
export function createUxSettingsDefault(): UxSettings {
  return Object.fromEntries(
    UX_FEATURE_IDS.map((id) => [id, UX_FEATURES[id].options[0]]),
  ) as UxSettings
}

/**
 * Checks whether a value is a valid option of a feature.
 *
 * @param id - Feature identifier.
 * @param value - Candidate option.
 */
export function isUxOptionValid<Id extends UxFeatureId>(
  id: Id,
  value: unknown,
): value is UxOption<Id> {
  return typeof value === 'string' && (UX_FEATURES[id].options as readonly string[]).includes(value)
}

/**
 * Resolves the effective settings for one participant.
 *
 * @param roomSettings - Room defaults (possibly partial, from older documents).
 * @param overrides - The participant's own choices for participant-scoped features.
 * @param isLocked - When true, participants cannot deviate from the room (controlled studies).
 */
export function resolveUxSettings(
  roomSettings: Partial<UxSettings>,
  overrides: Partial<UxSettings>,
  isLocked: boolean,
): UxSettings {
  const resolved = { ...createUxSettingsDefault() } as Record<UxFeatureId, string>
  for (const id of UX_FEATURE_IDS) {
    const roomValue = roomSettings[id]
    if (isUxOptionValid(id, roomValue)) resolved[id] = roomValue
    const ownValue = overrides[id]
    if (!isLocked && UX_FEATURES[id].scope === 'participant' && isUxOptionValid(id, ownValue)) {
      resolved[id] = ownValue
    }
  }
  return resolved as UxSettings
}

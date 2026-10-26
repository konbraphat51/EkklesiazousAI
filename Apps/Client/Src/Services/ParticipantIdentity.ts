// The local participant: pseudonymous id, display name, self-described background and own UX choices.
import { reactive, watch } from 'vue'
import type { UxSettings } from '@ekklesiazous/shared'
import { readStorage, writeStorage } from './StorageLocal'

/** Local participant state (persisted in this browser only). */
export interface ParticipantIdentity {
  /** Random id; never tied to the name, so private requests stay anonymous. */
  participantId: string
  /** Display name shown to others (cursors, explicit commands). */
  name: string
  /** Background used to pitch private explanations. */
  background: string
  /** Own choices for participant-scoped UX features. */
  uxOverrides: Partial<UxSettings>
  /** Whether the participant consented to audio capture in this browser. */
  hasConsentedToCapture: boolean
}

const STORAGE_KEY = 'ekklesiazous.identity'

function createParticipantId(): string {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The reactive identity singleton, persisted on change. */
export const identity = reactive<ParticipantIdentity>({
  participantId: createParticipantId(),
  name: '',
  background: '',
  uxOverrides: {},
  hasConsentedToCapture: false,
  ...readStorage<Partial<ParticipantIdentity>>(STORAGE_KEY, {}),
})

watch(identity, (value) => writeStorage(STORAGE_KEY, value), { deep: true })

/** Colors for cursors and speaker accents (index by number). */
export const PALETTE: readonly string[] = [
  '#4f6bed',
  '#d9480f',
  '#2b8a3e',
  '#ae3ec9',
  '#e8590c',
  '#1098ad',
  '#c2255c',
  '#5c940d',
]

/**
 * Picks a stable palette color for a string.
 *
 * @param key - Any identifier.
 */
export function pickColor(key: string): string {
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

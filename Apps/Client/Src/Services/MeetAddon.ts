// Google Meet add-on integration: the side panel is personal, the main stage shows the shared canvas
// to everyone in the call. The SDK is loaded lazily so the regular app never depends on it.
import type { AddonSession } from '@googleworkspace/meet-addons/meet.addons'

/** Data passed from the side panel to every main-stage frame. */
export interface MeetActivityData {
  /** Room shown on the main stage. */
  roomId: string
}

/** Google Cloud project number of the add-on (from VITE_MEET_CLOUD_PROJECT_NUMBER). */
export const MEET_CLOUD_PROJECT_NUMBER: string =
  (import.meta.env.VITE_MEET_CLOUD_PROJECT_NUMBER as string | undefined) ?? ''

/** Creates the add-on session; fails outside Meet or without a project number. */
export async function createMeetSession(): Promise<AddonSession> {
  if (!MEET_CLOUD_PROJECT_NUMBER) throw new Error('VITE_MEET_CLOUD_PROJECT_NUMBER is not set')
  const { meet } = await import('@googleworkspace/meet-addons/meet.addons')
  return meet.addon.createAddonSession({ cloudProjectNumber: MEET_CLOUD_PROJECT_NUMBER })
}

/**
 * Parses the activity data sent by the side panel.
 *
 * @param additionalData - Raw `additionalData` string.
 */
export function parseMeetActivityData(additionalData: string | undefined): MeetActivityData | null {
  try {
    const value = JSON.parse(additionalData ?? '') as Partial<MeetActivityData>
    return typeof value.roomId === 'string' && /^[a-z0-9]{6,32}$/.test(value.roomId)
      ? { roomId: value.roomId }
      : null
  } catch {
    return null
  }
}

// Private, one-click "I didn't follow" requests, shared by the transcript, canvas and hotkeys.
import { useI18n } from 'vue-i18n'
import type { LanguageInsight } from '@ekklesiazous/shared'
import { identity } from '../Services/ParticipantIdentity'
import { useRoomSession, type RoomSession } from '../Services/RoomSession'

/** Actions that open private clarifications. */
export interface ClarificationActions {
  /** Explains specific utterances (optionally a highlighted phrase in them). */
  askAboutSegments(segmentIds: string[], selectedText: string | null): void
  /** Explains the last ~20 seconds ("what was that?"). */
  askAboutRecent(): void
  /** Summarizes the last minutes ("what did I miss?"). */
  askRecap(minutes: number): void
}

/**
 * Returns clarification actions bound to the current room.
 *
 * @param sessionProvided - Session to use; required in the component that provides it.
 */
export function useClarification(sessionProvided?: RoomSession): ClarificationActions {
  const session = sessionProvided ?? useRoomSession()
  const { locale } = useI18n()
  const ask = (
    segmentIds: string[],
    selectedText: string | null,
    mode: 'utterance' | 'recap',
    recapMinutes: number,
  ): void => {
    session.log('clarificationRequested', segmentIds[0] ?? null, {
      mode,
      segmentCount: segmentIds.length,
      hasSelection: selectedText !== null,
    })
    void session.privateFeed
      .askClarification({
        participantId: identity.participantId,
        segmentIds,
        selectedText,
        mode,
        recapMinutes,
        language: locale.value as LanguageInsight,
        background: identity.background,
      })
      .catch(() => undefined)
  }
  return {
    askAboutSegments: (segmentIds, selectedText) => ask(segmentIds, selectedText, 'utterance', 1),
    askAboutRecent: () => ask([], null, 'utterance', 1),
    askRecap: (minutes) => ask([], null, 'recap', minutes),
  }
}

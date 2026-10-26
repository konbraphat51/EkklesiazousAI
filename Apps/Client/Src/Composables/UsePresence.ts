// Reactive presence of other participants (names, colors, cursors) from Yjs awareness.
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import type { BoardConnection, PresenceState } from '../Services/BoardConnection'

/** One other participant's presence. */
export interface PresencePeer extends PresenceState {
  /** Awareness client id. */
  clientId: number
}

/**
 * Tracks the presence of everyone except this client.
 *
 * @param connection - Board connection.
 */
export function usePresence(connection: BoardConnection): ShallowRef<PresencePeer[]> {
  const peers = shallowRef<PresencePeer[]>([])
  const refresh = (): void => {
    const ownId = connection.awareness.clientID
    const list: PresencePeer[] = []
    for (const [clientId, state] of connection.awareness.getStates()) {
      const presence = state as Partial<PresenceState>
      if (clientId !== ownId && presence.user) {
        list.push({
          clientId,
          user: presence.user,
          cursor: presence.cursor ?? null,
          layout: presence.layout ?? '',
        })
      }
    }
    peers.value = list
  }
  connection.awareness.on('change', refresh)
  refresh()
  onScopeDispose(() => connection.awareness.off('change', refresh))
  return peers
}

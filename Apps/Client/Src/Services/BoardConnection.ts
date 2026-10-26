// Connects a Yjs document to the server's sync hub and exposes it as a typed DocumentBoard.
import { shallowRef, type ShallowRef } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { DocumentBoard } from '@ekklesiazous/shared'

/** Sync connection state. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/** Presence published through Yjs awareness. */
export interface PresenceState {
  /** Who the participant is. */
  user: { name: string; color: string; participantId: string }
  /** Pointer position in canvas coordinates, or null when off-canvas. */
  cursor: { x: number; y: number } | null
  /** Layout the participant is viewing (cursors only make sense within the same layout). */
  layout: string
}

/** A live, synced board. */
export class BoardConnection {
  /** Typed board accessor. */
  readonly board: DocumentBoard
  /** Connection state. */
  readonly status: ShallowRef<ConnectionStatus> = shallowRef('connecting')
  /** Whether the first full sync completed. */
  readonly isSynced: ShallowRef<boolean> = shallowRef(false)
  private readonly provider: WebsocketProvider

  /**
   * @param roomId - Room (document) name.
   */
  constructor(roomId: string) {
    const doc = new Y.Doc()
    this.board = new DocumentBoard(doc)
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    this.provider = new WebsocketProvider(
      `${scheme}://${window.location.host}/ws/sync`,
      roomId,
      doc,
    )
    this.provider.on('status', (event: { status: ConnectionStatus }) => {
      this.status.value = event.status
    })
    this.provider.on('sync', (isSynced: boolean) => {
      if (isSynced) this.isSynced.value = true
    })
  }

  /** Awareness instance (presence of all participants). */
  get awareness(): WebsocketProvider['awareness'] {
    return this.provider.awareness
  }

  /**
   * Publishes a field of the local presence.
   *
   * @param field - Presence field.
   * @param value - New value.
   */
  setPresence<K extends keyof PresenceState>(field: K, value: PresenceState[K]): void {
    this.provider.awareness.setLocalStateField(field, value)
  }

  /** Closes the connection. */
  destroy(): void {
    this.provider.destroy()
    this.board.doc.destroy()
  }
}

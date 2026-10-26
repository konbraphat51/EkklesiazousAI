// Everything a room page shares with its components, provided once and injected where needed.
import {
  computed,
  inject,
  provide,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue'
import {
  resolveUxSettings,
  type DocumentBoard,
  type InteractionEventType,
  type ServerCapabilities,
  type UxSettings,
} from '@ekklesiazous/shared'
import { useBoardState, type BoardState } from '../Composables/UseBoardState'
import { BoardConnection } from './BoardConnection'
import { InteractionLogger } from './InteractionLogger'
import { identity } from './ParticipantIdentity'
import { PrivateFeed } from './PrivateFeed'

/** A request to bring a canvas item into view. */
export interface FocusRequest {
  /** Item to show. */
  itemId: string
  /** Request time, so repeated requests for the same item still trigger. */
  at: number
}

/** Shared services and state of an open room. */
export interface RoomSession {
  /** Room id. */
  roomId: string
  /** Sync connection. */
  connection: BoardConnection
  /** Typed board. */
  board: DocumentBoard
  /** Reactive board state. */
  state: BoardState
  /** Effective UX settings for this participant. */
  ux: ComputedRef<UxSettings>
  /** Server capabilities (null until loaded). */
  capabilities: ShallowRef<ServerCapabilities | null>
  /** Private results drawer. */
  privateFeed: PrivateFeed
  /** Latest request to bring an item into view. */
  focusRequest: ShallowRef<FocusRequest | null>
  /** Logs an interaction for UX studies. */
  log(
    type: InteractionEventType,
    targetId?: string | null,
    details?: Record<string, string | number | boolean | null>,
  ): void
  /** Releases connections and timers. */
  dispose(): void
}

const ROOM_SESSION_KEY: InjectionKey<RoomSession> = Symbol('RoomSession')

/**
 * Creates the session of a room and provides it to descendants (call inside a component setup).
 *
 * @param roomId - Room to open.
 */
export function provideRoomSession(roomId: string): RoomSession {
  const connection = new BoardConnection(roomId)
  const state = useBoardState(connection.board)
  const ux = computed(() =>
    resolveUxSettings(
      state.meta.value.uxSettings,
      identity.uxOverrides,
      state.meta.value.isUxLocked,
    ),
  )
  const logger = new InteractionLogger(roomId, identity.participantId, () => ux.value)
  const session: RoomSession = {
    roomId,
    connection,
    board: connection.board,
    state,
    ux,
    capabilities: shallowRef(null),
    privateFeed: new PrivateFeed(roomId),
    focusRequest: shallowRef(null),
    log: (type, targetId = null, details = {}) => logger.log(type, targetId, details),
    dispose: () => {
      logger.dispose()
      connection.destroy()
    },
  }
  provide(ROOM_SESSION_KEY, session)
  return session
}

/** Injects the current room session (components inside a room page only). */
export function useRoomSession(): RoomSession {
  const session = inject(ROOM_SESSION_KEY)
  if (!session) throw new Error('useRoomSession() called outside a room page')
  return session
}

// Creates, loads, keeps and persists the meeting rooms served by this process.
import * as Y from 'yjs'
import { customAlphabet } from 'nanoid'
import { DocumentBoard, createMeetingMetaDefault, type CaptureMode } from '@ekklesiazous/shared'
import type { RoomStore } from './RoomStore'

const generateRoomId = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 10)
const ROOM_ID_PATTERN = /^[a-z0-9]{6,32}$/
const SAVE_DEBOUNCE_MS = 2000

/** A live room: its shared board plus whatever runtime the factory attached. */
export interface RoomMeeting {
  /** Room identifier. */
  readonly roomId: string
  /** Shared board document. */
  readonly board: DocumentBoard
  /** Stops background work of the room. */
  dispose(): void
}

/** Builds the runtime of a room around its board. */
export type RoomFactory = (roomId: string, board: DocumentBoard) => RoomMeeting

/** Registry of live rooms with lazy loading and debounced persistence. */
export class RoomRegistry {
  private readonly rooms = new Map<string, RoomMeeting>()
  private readonly opening = new Map<string, Promise<RoomMeeting | null>>()

  /**
   * @param store - Snapshot storage.
   * @param createRoom - Factory that attaches the runtime (agent, recognizers) to a board.
   */
  constructor(
    private readonly store: RoomStore,
    private readonly createRoom: RoomFactory,
  ) {}

  /**
   * Checks whether a string is a syntactically valid room id.
   *
   * @param roomId - Candidate id.
   */
  static isRoomIdValid(roomId: string): boolean {
    return ROOM_ID_PATTERN.test(roomId)
  }

  /**
   * Creates a new room.
   *
   * @param title - Meeting title.
   * @param captureMode - Initial capture mode.
   * @returns The live room.
   */
  async create(title: string, captureMode: CaptureMode): Promise<RoomMeeting> {
    const roomId = generateRoomId()
    const board = new DocumentBoard(new Y.Doc())
    board.patchMeta({ ...createMeetingMetaDefault(Date.now()), title, captureMode }, 'system')
    const room = this.attach(roomId, board)
    await this.store.save(roomId, Y.encodeStateAsUpdate(board.doc))
    return room
  }

  /**
   * Gets a live room, loading it from storage on first access.
   *
   * @param roomId - Room identifier.
   * @returns The room, or null if it does not exist.
   */
  async open(roomId: string): Promise<RoomMeeting | null> {
    if (!RoomRegistry.isRoomIdValid(roomId)) return null
    const live = this.rooms.get(roomId)
    if (live) return live
    // concurrent openers share one load
    const pending = this.opening.get(roomId) ?? this.load(roomId)
    this.opening.set(roomId, pending)
    try {
      return await pending
    } finally {
      this.opening.delete(roomId)
    }
  }

  /**
   * Gets a room only if it is already live.
   *
   * @param roomId - Room identifier.
   */
  get(roomId: string): RoomMeeting | undefined {
    return this.rooms.get(roomId)
  }

  private async load(roomId: string): Promise<RoomMeeting | null> {
    const state = await this.store.load(roomId)
    if (!state) return null
    const doc = new Y.Doc()
    Y.applyUpdate(doc, state)
    return this.attach(roomId, new DocumentBoard(doc))
  }

  private attach(roomId: string, board: DocumentBoard): RoomMeeting {
    const room = this.createRoom(roomId, board)
    this.rooms.set(roomId, room)

    let timer: NodeJS.Timeout | null = null
    board.doc.on('update', () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void this.store.save(roomId, Y.encodeStateAsUpdate(board.doc))
      }, SAVE_DEBOUNCE_MS)
    })
    return room
  }
}

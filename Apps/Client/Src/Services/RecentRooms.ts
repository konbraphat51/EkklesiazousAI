// Rooms recently opened in this browser, for quick re-entry from the lobby.
import { readStorage, writeStorage } from './StorageLocal'

/** A remembered room. */
export interface RecentRoom {
  /** Room id. */
  roomId: string
  /** Meeting title when last seen. */
  title: string
  /** Last visit (epoch ms). */
  visitedAt: number
}

const STORAGE_KEY = 'ekklesiazous.recentRooms'
const LIMIT = 8

/** Lists remembered rooms, newest first. */
export function listRecentRooms(): RecentRoom[] {
  return readStorage<RecentRoom[]>(STORAGE_KEY, [])
}

/**
 * Remembers a visit.
 *
 * @param roomId - Room id.
 * @param title - Meeting title.
 */
export function rememberRoom(roomId: string, title: string): void {
  const others = listRecentRooms().filter((room) => room.roomId !== roomId)
  writeStorage(STORAGE_KEY, [{ roomId, title, visitedAt: Date.now() }, ...others].slice(0, LIMIT))
}

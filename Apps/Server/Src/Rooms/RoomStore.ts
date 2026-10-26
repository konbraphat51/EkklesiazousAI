// Persists room documents as Yjs state snapshots on the local disk.
import { mkdir, readFile, rename, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

/** File-based storage of Yjs document snapshots, one file per room. */
export class RoomStore {
  /**
   * @param directory - Directory that holds the snapshot files.
   */
  constructor(private readonly directory: string) {}

  /**
   * Loads a room snapshot.
   *
   * @param roomId - Room identifier.
   * @returns The encoded Yjs state, or null if the room was never saved.
   */
  async load(roomId: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathOf(roomId)))
    } catch {
      return null
    }
  }

  /**
   * Saves a room snapshot atomically (write to temp file, then rename).
   *
   * @param roomId - Room identifier.
   * @param state - Encoded Yjs state.
   */
  async save(roomId: string, state: Uint8Array): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const target = this.pathOf(roomId)
    const temporary = `${target}.tmp`
    await writeFile(temporary, state)
    await rename(temporary, target)
  }

  /**
   * Checks whether a snapshot exists.
   *
   * @param roomId - Room identifier.
   */
  async exists(roomId: string): Promise<boolean> {
    try {
      await access(this.pathOf(roomId))
      return true
    } catch {
      return false
    }
  }

  private pathOf(roomId: string): string {
    return path.join(this.directory, `${roomId}.yjs`)
  }
}

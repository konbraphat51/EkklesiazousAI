// Yjs sync hub speaking the y-websocket wire protocol, so browsers can use the stock WebsocketProvider
// while server-side code (the agent) edits the very same in-memory documents.
import type * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { WebSocket, type RawData } from 'ws'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const PING_INTERVAL_MS = 30_000

interface SyncRoomEntry {
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  /** Each connection with the awareness client ids it controls. */
  connections: Map<WebSocket, Set<number>>
  detach: () => void
}

/** Resolves the document of a room, or null when the room does not exist. */
export type DocumentResolver = (roomId: string) => Promise<Y.Doc | null>

/** Serves Yjs documents to WebSocket clients and relays awareness (cursors, names). */
export class SyncHub {
  private readonly entries = new Map<string, SyncRoomEntry>()

  /**
   * @param resolveDocument - Provides the shared document of a room.
   */
  constructor(private readonly resolveDocument: DocumentResolver) {}

  /**
   * Attaches a freshly upgraded WebSocket to a room document.
   *
   * @param socket - Client connection.
   * @param roomId - Room (document) name.
   */
  async handleConnection(socket: WebSocket, roomId: string): Promise<void> {
    socket.binaryType = 'arraybuffer'
    // queue messages that arrive while the document is being resolved
    const queued: Uint8Array[] = []
    let entry: SyncRoomEntry | null = null
    socket.on('message', (data: RawData) => {
      const message = toUint8Array(data)
      if (entry) this.handleMessage(entry, socket, message)
      else queued.push(message)
    })

    const doc = await this.resolveDocument(roomId)
    if (!doc || socket.readyState !== WebSocket.OPEN) {
      socket.close(4404, 'room not found')
      return
    }
    entry = this.obtainEntry(roomId, doc)
    entry.connections.set(socket, new Set())
    this.startKeepAlive(socket)
    socket.on('close', () => this.closeConnection(roomId, socket))

    this.sendSyncStep1(entry, socket)
    this.sendAwarenessSnapshot(entry, socket)
    for (const message of queued.splice(0)) this.handleMessage(entry, socket, message)
  }

  /**
   * Counts open connections in a room.
   *
   * @param roomId - Room identifier.
   */
  countConnections(roomId: string): number {
    return this.entries.get(roomId)?.connections.size ?? 0
  }

  private obtainEntry(roomId: string, doc: Y.Doc): SyncRoomEntry {
    const existing = this.entries.get(roomId)
    if (existing) return existing

    const awareness = new awarenessProtocol.Awareness(doc)
    // the server is not a visible participant
    awareness.setLocalState(null)
    const connections = new Map<WebSocket, Set<number>>()

    const onUpdate = (update: Uint8Array): void => {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      broadcast(connections.keys(), encoding.toUint8Array(encoder))
    }
    const onAwareness = (
      change: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ): void => {
      const changedClients = [...change.added, ...change.updated, ...change.removed]
      const controlled = origin instanceof WebSocket ? connections.get(origin) : undefined
      if (controlled) {
        for (const id of change.added) controlled.add(id)
        for (const id of change.removed) controlled.delete(id)
      }
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
      )
      broadcast(connections.keys(), encoding.toUint8Array(encoder))
    }
    doc.on('update', onUpdate)
    awareness.on('update', onAwareness)

    const entry: SyncRoomEntry = {
      doc,
      awareness,
      connections,
      detach: () => {
        doc.off('update', onUpdate)
        awareness.off('update', onAwareness)
        awareness.destroy()
      },
    }
    this.entries.set(roomId, entry)
    return entry
  }

  private handleMessage(entry: SyncRoomEntry, socket: WebSocket, message: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, entry.doc, 'participant')
        // only step 2 replies carry content beyond the message type
        if (encoding.length(encoder) > 1) send(socket, encoding.toUint8Array(encoder))
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          entry.awareness,
          decoding.readVarUint8Array(decoder),
          socket,
        )
      }
    } catch {
      socket.close(4400, 'malformed message')
    }
  }

  private sendSyncStep1(entry: SyncRoomEntry, socket: WebSocket): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, entry.doc)
    send(socket, encoding.toUint8Array(encoder))
  }

  private sendAwarenessSnapshot(entry: SyncRoomEntry, socket: WebSocket): void {
    const clients = Array.from(entry.awareness.getStates().keys())
    if (clients.length === 0) return
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, clients),
    )
    send(socket, encoding.toUint8Array(encoder))
  }

  private startKeepAlive(socket: WebSocket): void {
    let isAlive = true
    socket.on('pong', () => {
      isAlive = true
    })
    const timer = setInterval(() => {
      if (!isAlive) {
        socket.terminate()
        return
      }
      isAlive = false
      socket.ping()
    }, PING_INTERVAL_MS)
    socket.on('close', () => clearInterval(timer))
  }

  private closeConnection(roomId: string, socket: WebSocket): void {
    const entry = this.entries.get(roomId)
    if (!entry) return
    const controlled = entry.connections.get(socket)
    entry.connections.delete(socket)
    if (controlled && controlled.size > 0) {
      awarenessProtocol.removeAwarenessStates(entry.awareness, Array.from(controlled), null)
    }
    if (entry.connections.size === 0) {
      entry.detach()
      this.entries.delete(roomId)
    }
  }
}

function send(socket: WebSocket, message: Uint8Array): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(message)
}

function broadcast(sockets: Iterable<WebSocket>, message: Uint8Array): void {
  for (const socket of sockets) send(socket, message)
}

function toUint8Array(data: RawData): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data))
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

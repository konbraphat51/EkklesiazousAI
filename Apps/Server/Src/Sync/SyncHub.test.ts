// Integration test: stock y-websocket clients stay in sync with server-side edits through SyncHub.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { SyncHub } from './SyncHub'

const servers: Server[] = []
const providers: WebsocketProvider[] = []

afterEach(() => {
  for (const provider of providers.splice(0)) provider.destroy()
  for (const server of servers.splice(0)) server.close()
})

async function startHub(docs: Map<string, Y.Doc>): Promise<string> {
  const hub = new SyncHub(async (roomId) => docs.get(roomId) ?? null)
  const sockets = new WebSocketServer({ noServer: true })
  const server = createServer()
  server.on('upgrade', (request, socket, head) => {
    const roomId = (request.url ?? '').split('/').pop() ?? ''
    sockets.handleUpgrade(request, socket, head, (ws) => void hub.handleConnection(ws, roomId))
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  return `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws/sync`
}

function connect(url: string, roomId: string): { doc: Y.Doc; provider: WebsocketProvider } {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(url, roomId, doc, {
    WebSocketPolyfill: WebSocket as never,
  })
  providers.push(provider)
  return { doc, provider }
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('condition not met')
}

describe('SyncHub', () => {
  it('delivers initial state and server-side edits to clients', async () => {
    const serverDoc = new Y.Doc()
    serverDoc.getMap('meta').set('title', 'Kickoff')
    const url = await startHub(new Map([['room1', serverDoc]]))
    const client = connect(url, 'room1')

    await waitFor(() => client.doc.getMap('meta').get('title') === 'Kickoff')
    serverDoc.getMap('insights').set('a', { title: 'from agent' })
    await waitFor(() => client.doc.getMap('insights').has('a'))
  })

  it('relays client edits to the server document and other clients', async () => {
    const serverDoc = new Y.Doc()
    const url = await startHub(new Map([['room1', serverDoc]]))
    const alice = connect(url, 'room1')
    const bob = connect(url, 'room1')
    await waitFor(() => alice.provider.synced && bob.provider.synced)

    alice.doc.getMap('notes').set('n1', { text: 'hello' })
    await waitFor(() => serverDoc.getMap('notes').has('n1') && bob.doc.getMap('notes').has('n1'))
  })

  it('shares awareness between clients', async () => {
    const url = await startHub(new Map([['room1', new Y.Doc()]]))
    const alice = connect(url, 'room1')
    const bob = connect(url, 'room1')
    await waitFor(() => alice.provider.synced && bob.provider.synced)

    alice.provider.awareness.setLocalStateField('user', { name: 'Alice' })
    await waitFor(() =>
      Array.from(bob.provider.awareness.getStates().values()).some(
        (state) => (state as { user?: { name: string } }).user?.name === 'Alice',
      ),
    )
  })

  it('rejects unknown rooms', async () => {
    const url = await startHub(new Map())
    const socket = new WebSocket(`${url}/missing`)
    const code = await new Promise<number>((resolve) => socket.on('close', resolve))
    expect(code).toBe(4404)
  })
})

// HTTP API, WebSocket upgrade routing and static hosting of the built client.
import { existsSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import type { ServerCapabilities } from '@ekklesiazous/shared'
import type { AudioGateway } from '../Audio/AudioGateway'
import { RoomRegistry } from '../Rooms/RoomRegistry'
import type { RoomRuntime } from '../Rooms/RoomRuntime'
import { renderMinutes } from '../Rooms/MinutesExporter'
import type { SyncHub } from '../Sync/SyncHub'
import type { ZoomRtmsGateway } from '../Zoom/ZoomRtmsGateway'
import type { MeetingBotGateway } from '../Bots/MeetingBotGateway'

declare module 'fastify' {
  interface FastifyRequest {
    /** Raw JSON body, kept for webhook signature verification. */
    rawBody?: string
  }
}

const roomCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  meetingPlatform: z.enum(['inPerson', 'zoom', 'googleMeet', 'teams', 'other']),
  captureMode: z.enum([
    'roomMicrophone',
    'onlineHostCapture',
    'onlinePerParticipant',
    'zoomRtms',
    'demo',
  ]),
})
const agentControlSchema = z.object({
  action: z.enum(['start', 'pause', 'startDemo', 'stopDemo']),
})
const commandSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  requesterName: z.string().max(80),
  participantId: z.string().min(1).max(80),
  depth: z.enum(['quick', 'standard', 'deep']),
  isPrivate: z.boolean(),
})
const layerSchema = z.object({ layer: z.enum(['detail', 'deep']), isPrefetch: z.boolean() })
const clarificationSchema = z.object({
  participantId: z.string().min(1).max(80),
  segmentIds: z.array(z.string().max(40)).max(20),
  selectedText: z.string().max(300).nullable(),
  mode: z.enum(['utterance', 'recap']),
  recapMinutes: z.number().min(1).max(30),
  language: z.enum(['en', 'ja']),
  background: z.string().max(500),
})
const dissentSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  participantId: z.string().min(1).max(80),
})
const eventBatchSchema = z.object({ events: z.array(z.record(z.string(), z.unknown())).max(500) })
const botInviteSchema = z.object({ meetingUrl: z.string().url().max(500) })

/** Dependencies of the HTTP server. */
export interface ServerHttpDependencies {
  /** Live and stored rooms. */
  registry: RoomRegistry<RoomRuntime>
  /** Yjs sync hub. */
  syncHub: SyncHub
  /** Browser audio gateway. */
  audioGateway: AudioGateway
  /** Zoom RTMS gateway, when configured. */
  zoomGateway: ZoomRtmsGateway | null
  /** Meeting-bot gateway, when configured. */
  botGateway: MeetingBotGateway | null
  /** Capability report. */
  capabilities: ServerCapabilities
  /** Directory of the built client, served when it exists. */
  clientDistDirectory: string
}

/**
 * Builds the Fastify app with all routes and WebSocket upgrades.
 *
 * @param dependencies - Services the routes use.
 */
export async function createServerHttp(
  dependencies: ServerHttpDependencies,
): Promise<FastifyInstance> {
  const { registry } = dependencies
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: 1_000_000 })
  await app.register(cors, { origin: true })

  // keep the raw body: Zoom webhooks are verified over the exact bytes
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8')
    request.rawBody = text
    try {
      done(null, text.length > 0 ? JSON.parse(text) : {})
    } catch (error) {
      done(error as Error, undefined)
    }
  })

  const withRoom = async (
    request: FastifyRequest<{ Params: { roomId: string } }>,
    reply: FastifyReply,
  ): Promise<RoomRuntime | null> => {
    const room = await registry.open(request.params.roomId)
    if (!room) void reply.code(404).send({ error: 'room not found' })
    return room
  }

  app.get('/api/health', async () => ({ ok: true }))
  app.get('/api/config', async () => dependencies.capabilities)

  app.post('/api/rooms', async (request, reply) => {
    const body = roomCreateSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.message })
    const room = await registry.create(
      body.data.title,
      body.data.captureMode,
      body.data.meetingPlatform,
    )
    return { roomId: room.roomId }
  })

  app.get<{ Params: { roomId: string } }>('/api/rooms/:roomId', async (request, reply) => {
    const room = await withRoom(request, reply)
    if (!room) return reply
    return { roomId: room.roomId, meta: room.board.readMeta(), isDemoPlaying: room.isDemoPlaying }
  })

  app.post<{ Params: { roomId: string } }>('/api/rooms/:roomId/agent', async (request, reply) => {
    const room = await withRoom(request, reply)
    if (!room) return reply
    const body = agentControlSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.message })
    if (body.data.action === 'start') room.agent.setAgentState('listening')
    if (body.data.action === 'pause') room.agent.setAgentState('paused')
    if (body.data.action === 'startDemo') room.startDemo()
    if (body.data.action === 'stopDemo') room.stopDemo()
    return { ok: true }
  })

  app.post<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId/commands',
    async (request, reply) => {
      const room = await withRoom(request, reply)
      if (!room) return reply
      const body = commandSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.message })
      if (!body.data.isPrivate) {
        const insightId = await room.agent.issueCommand(body.data)
        if (!insightId) return reply.code(422).send({ error: 'not a research request' })
        return { insightId }
      }
      const stream = startNdjson(reply)
      const insightId = await room.agent.issueCommand(body.data, (insight) => {
        stream.write(insight)
        if (insight.status === 'failed' || isPrivateComplete(insight)) stream.end()
      })
      if (!insightId) stream.end()
      return reply
    },
  )

  app.post<{ Params: { roomId: string; insightId: string } }>(
    '/api/rooms/:roomId/insights/:insightId/layers',
    async (request, reply) => {
      const room = await withRoom(request, reply)
      if (!room) return reply
      const body = layerSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.message })
      const isAccepted = room.agent.requestLayer(
        request.params.insightId,
        body.data.layer,
        body.data.isPrefetch,
      )
      return { isAccepted }
    },
  )

  app.post<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId/clarifications',
    async (request, reply) => {
      const room = await withRoom(request, reply)
      if (!room) return reply
      const body = clarificationSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.message })
      const controller = new AbortController()
      request.raw.on('close', () => controller.abort())
      const stream = startNdjson(reply)
      await room.agent.askClarification(
        body.data,
        (snapshot) => stream.write(snapshot),
        controller.signal,
      )
      stream.end()
      return reply
    },
  )

  app.post<{ Params: { roomId: string; clarificationId: string } }>(
    '/api/rooms/:roomId/clarifications/:clarificationId/share',
    async (request, reply) => {
      const room = await withRoom(request, reply)
      if (!room) return reply
      const insightId = room.agent.shareClarification(request.params.clarificationId)
      if (!insightId) return reply.code(404).send({ error: 'clarification not found' })
      return { insightId }
    },
  )

  app.post<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId/dissents',
    async (request, reply) => {
      const room = await withRoom(request, reply)
      if (!room) return reply
      const body = dissentSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.message })
      return { result: await room.agent.raiseDissent(body.data.text, body.data.participantId) }
    },
  )

  app.post<{ Params: { roomId: string } }>('/api/rooms/:roomId/events', async (request, reply) => {
    const room = await withRoom(request, reply)
    if (!room) return reply
    const body = eventBatchSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.message })
    room.agent.recordClientEvents(body.data.events as never)
    return { ok: true }
  })

  app.get<{ Params: { roomId: string } }>('/api/rooms/:roomId/minutes', async (request, reply) => {
    const room = await withRoom(request, reply)
    if (!room) return reply
    return reply
      .type('text/markdown; charset=utf-8')
      .header('content-disposition', `attachment; filename="minutes-${room.roomId}.md"`)
      .send(renderMinutes(room.board))
  })

  app.post<{ Params: { roomId: string } }>('/api/rooms/:roomId/bot', async (request, reply) => {
    if (!dependencies.botGateway)
      return reply.code(404).send({ error: 'meeting bot not configured' })
    const room = await withRoom(request, reply)
    if (!room) return reply
    const body = botInviteSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.message })
    try {
      return { botId: await dependencies.botGateway.invite(room, body.data.meetingUrl) }
    } catch (error) {
      return reply.code(502).send({ error: String(error instanceof Error ? error.message : error) })
    }
  })

  app.post('/api/zoom/webhook', async (request, reply) => {
    if (!dependencies.zoomGateway)
      return reply.code(404).send({ error: 'Zoom RTMS not configured' })
    const response = dependencies.zoomGateway.handleWebhook(request.rawBody ?? '', request.headers)
    return reply.code(response.status).send(response.body)
  })

  if (existsSync(dependencies.clientDistDirectory)) {
    await app.register(fastifyStatic, { root: dependencies.clientDistDirectory })
    // single-page app: unknown non-API routes fall back to index.html
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' })
      return reply.sendFile('index.html')
    })
  }

  attachWebSockets(app, dependencies)
  return app
}

function attachWebSockets(app: FastifyInstance, dependencies: ServerHttpDependencies): void {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4_000_000 })
  app.server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const match = /^\/ws\/(sync|audio|bot)\/([a-z0-9]+)$/.exec(url.pathname)
    if (!match || !RoomRegistry.isRoomIdValid(match[2]!)) {
      socket.destroy()
      return
    }
    const [, channel, roomId] = match as unknown as [string, 'sync' | 'audio' | 'bot', string]
    const botGateway = dependencies.botGateway
    if (
      channel === 'bot' &&
      !botGateway?.isAuthorized(roomId, url.searchParams.get('token') ?? '')
    ) {
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      if (channel === 'sync') {
        void dependencies.syncHub.handleConnection(webSocket, roomId)
        return
      }
      void dependencies.registry.open(roomId).then((room) => {
        if (!room) webSocket.close(4404, 'room not found')
        else if (channel === 'bot') botGateway!.handleConnection(webSocket, room)
        else dependencies.audioGateway.handleConnection(webSocket, room)
      })
    })
  })
}

/** Writer of a newline-delimited JSON response. */
interface NdjsonStream {
  write(value: unknown): void
  end(): void
}

function startNdjson(reply: FastifyReply): NdjsonStream {
  reply.hijack()
  reply.raw.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  })
  let isEnded = false
  return {
    write: (value) => {
      if (!isEnded) reply.raw.write(`${JSON.stringify(value)}\n`)
    },
    end: () => {
      if (isEnded) return
      isEnded = true
      reply.raw.end()
    },
  }
}

function isPrivateComplete(insight: {
  status: string
  depth: string
  detailStatus: string
  deepStatus: string
}): boolean {
  if (insight.status !== 'ready') return false
  if (insight.detailStatus === 'running' || insight.detailStatus === 'none') return false
  return (
    insight.depth !== 'deep' || insight.deepStatus === 'ready' || insight.deepStatus === 'failed'
  )
}

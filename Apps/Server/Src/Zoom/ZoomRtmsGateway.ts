// Zoom Realtime Media Streams: verifies webhooks, joins RTMS streams and feeds per-participant audio
// into the matching room (raw protocol, since the official SDK does not run on Windows).
import { createHmac, timingSafeEqual } from 'node:crypto'
import { WebSocket } from 'ws'
import type { AgentLogger } from '../Agent/AgentToolkit'
import type { AudioIngest } from '../Audio/AudioIngest'
import { ParticipantStreams } from '../Audio/ParticipantStreams'
import type { RoomRuntime } from '../Rooms/RoomRuntime'

/** Zoom app credentials. */
export interface ZoomRtmsCredentials {
  /** OAuth client id of the Marketplace app. */
  clientId: string
  /** OAuth client secret. */
  clientSecret: string
  /** Webhook secret token. */
  webhookSecretToken: string
}

/** HTTP response for a webhook call. */
export interface WebhookResponse {
  /** HTTP status. */
  status: number
  /** JSON body. */
  body: object
}

interface RtmsPayload {
  meeting_uuid?: string
  meeting_id?: string | number
  rtms_stream_id?: string
  server_urls?: string
  object?: { id?: string | number; uuid?: string }
}

interface RtmsSession {
  room: RoomRuntime
  sockets: WebSocket[]
  participants: ParticipantStreams
}

/**
 * Computes the RTMS handshake signature.
 *
 * @param credentials - App credentials.
 * @param meetingUuid - Meeting UUID from the webhook.
 * @param streamId - RTMS stream id from the webhook.
 */
export function signRtmsHandshake(
  credentials: Pick<ZoomRtmsCredentials, 'clientId' | 'clientSecret'>,
  meetingUuid: string,
  streamId: string,
): string {
  return createHmac('sha256', credentials.clientSecret)
    .update(`${credentials.clientId},${meetingUuid},${streamId}`)
    .digest('hex')
}

/**
 * Verifies the `x-zm-signature` header of a webhook request.
 *
 * @param secretToken - Webhook secret token.
 * @param timestamp - `x-zm-request-timestamp` header.
 * @param rawBody - Raw request body.
 * @param signature - `x-zm-signature` header.
 */
export function verifyWebhookSignature(
  secretToken: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = `v0=${createHmac('sha256', secretToken).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Receives Zoom webhooks and runs RTMS sessions. */
export class ZoomRtmsGateway {
  private readonly sessions = new Map<string, RtmsSession>()

  /**
   * @param credentials - App credentials.
   * @param findRoom - Finds the live room configured for a Zoom meeting id/uuid.
   * @param ingest - Opens recognizer streams.
   * @param log - Logger.
   */
  constructor(
    private readonly credentials: ZoomRtmsCredentials,
    private readonly findRoom: (meetingKeys: string[]) => RoomRuntime | undefined,
    private readonly ingest: AudioIngest,
    private readonly log: AgentLogger,
  ) {}

  /**
   * Handles one webhook call.
   *
   * @param rawBody - Raw body (needed for the signature).
   * @param headers - Request headers.
   */
  handleWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookResponse {
    let message: { event?: string; payload?: RtmsPayload & { plainToken?: string } }
    try {
      message = JSON.parse(rawBody) as typeof message
    } catch {
      return { status: 400, body: { error: 'invalid json' } }
    }
    if (message.event === 'endpoint.url_validation' && message.payload?.plainToken) {
      const plainToken = message.payload.plainToken
      const encryptedToken = createHmac('sha256', this.credentials.webhookSecretToken)
        .update(plainToken)
        .digest('hex')
      return { status: 200, body: { plainToken, encryptedToken } }
    }
    const timestamp = String(headers['x-zm-request-timestamp'] ?? '')
    const signature = String(headers['x-zm-signature'] ?? '')
    if (
      !verifyWebhookSignature(this.credentials.webhookSecretToken, timestamp, rawBody, signature)
    ) {
      return { status: 401, body: { error: 'invalid signature' } }
    }
    const payload = message.payload ?? {}
    if (message.event === 'meeting.rtms_started') this.start(payload)
    if (message.event === 'meeting.rtms_stopped') this.stop(payload.rtms_stream_id ?? '')
    return { status: 200, body: { ok: true } }
  }

  private start(payload: RtmsPayload): void {
    const {
      meeting_uuid: meetingUuid,
      rtms_stream_id: streamId,
      server_urls: signalingUrl,
    } = payload
    if (!meetingUuid || !streamId || !signalingUrl || this.sessions.has(streamId)) return
    const keys = [meetingUuid, payload.meeting_id, payload.object?.id, payload.object?.uuid]
      .filter((key): key is string | number => key !== undefined && key !== null)
      .map((key) => String(key).replace(/\s+/g, ''))
    const room = this.findRoom(keys)
    if (!room) {
      this.log.warn({ keys }, 'RTMS started for a meeting no room is linked to')
      return
    }
    const session: RtmsSession = {
      room,
      sockets: [],
      participants: new ParticipantStreams(room.board, this.ingest, 'zoomRtms', 'zoom', this.log),
    }
    this.sessions.set(streamId, session)
    room.board.patchMeta({ captureMode: 'zoomRtms' }, 'system')
    room.handleAudioStarted()

    const signature = signRtmsHandshake(this.credentials, meetingUuid, streamId)
    const signaling = new WebSocket(signalingUrl)
    session.sockets.push(signaling)
    signaling.on('open', () => {
      signaling.send(
        JSON.stringify({
          msg_type: 1,
          protocol_version: 1,
          sequence: 1,
          meeting_uuid: meetingUuid,
          rtms_stream_id: streamId,
          signature,
          buffer_data: false,
        }),
      )
    })
    signaling.on('message', (data) => {
      const message = parse(data.toString())
      if (message.msg_type === 12) {
        signaling.send(JSON.stringify({ msg_type: 13, timestamp: message.timestamp }))
      } else if (message.msg_type === 2) {
        const audioUrl = readAudioUrl(message)
        if (message.status_code !== 0 || !audioUrl) {
          this.log.warn({ status: message.status_code }, 'RTMS signaling handshake failed')
          this.stop(streamId)
          return
        }
        this.connectMedia(session, audioUrl, meetingUuid, streamId, signature, signaling)
      } else if (message.msg_type === 21 || message.msg_type === 22) {
        this.stop(streamId)
      }
    })
    signaling.on('close', () => this.stop(streamId))
    signaling.on('error', (error) =>
      this.log.warn({ error: String(error) }, 'RTMS signaling error'),
    )
  }

  private connectMedia(
    session: RtmsSession,
    audioUrl: string,
    meetingUuid: string,
    streamId: string,
    signature: string,
    signaling: WebSocket,
  ): void {
    const media = new WebSocket(audioUrl)
    session.sockets.push(media)
    media.on('open', () => {
      media.send(
        JSON.stringify({
          msg_type: 3,
          protocol_version: 1,
          sequence: 0,
          meeting_uuid: meetingUuid,
          rtms_stream_id: streamId,
          signature,
          media_type: 1,
          payload_encryption: false,
          // per-speaker L16 16 kHz mono streams every 20 ms
          media_params: {
            audio: {
              content_type: 2,
              sample_rate: 1,
              channel: 1,
              codec: 1,
              data_opt: 2,
              send_rate: 20,
            },
          },
        }),
      )
    })
    media.on('message', (data) => {
      const message = parse(data.toString())
      if (message.msg_type === 4 && message.status_code === 0) {
        signaling.send(JSON.stringify({ msg_type: 7, rtms_stream_id: streamId }))
      } else if (message.msg_type === 12) {
        media.send(JSON.stringify({ msg_type: 13, timestamp: message.timestamp }))
      } else if (message.msg_type === 14) {
        const content = (message.content ?? {}) as {
          user_id?: number
          user_name?: string
          data?: string
        }
        if (content.data) this.pushParticipantAudio(session, content)
      }
    })
    media.on('error', (error) => this.log.warn({ error: String(error) }, 'RTMS media error'))
  }

  private pushParticipantAudio(
    session: RtmsSession,
    content: { user_id?: number; user_name?: string; data?: string },
  ): void {
    const userKey = String(content.user_id ?? 0)
    const pcm = new Uint8Array(Buffer.from(content.data ?? '', 'base64'))
    session.participants.push(userKey, content.user_name ?? '', pcm)
  }

  private stop(streamId: string): void {
    const session = this.sessions.get(streamId)
    if (!session) return
    this.sessions.delete(streamId)
    for (const socket of session.sockets) socket.close()
    session.participants.close()
  }
}

function parse(
  text: string,
): Record<string, unknown> & { msg_type?: number; status_code?: number; timestamp?: number } {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readAudioUrl(message: Record<string, unknown>): string | null {
  const server = message.media_server as
    { server_urls?: { audio?: string; all?: string } } | undefined
  return server?.server_urls?.audio ?? server?.server_urls?.all ?? null
}

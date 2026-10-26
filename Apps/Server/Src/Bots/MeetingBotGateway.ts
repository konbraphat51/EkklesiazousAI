// Meeting bot (Recall.ai, experimental): joins a Google Meet / Teams / Zoom meeting and streams
// per-participant audio with names to `/ws/bot/:roomId?token=…`.
import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { AgentLogger } from '../Agent/AgentToolkit'
import type { AudioIngest } from '../Audio/AudioIngest'
import { ParticipantStreams } from '../Audio/ParticipantStreams'
import type { RoomRuntime } from '../Rooms/RoomRuntime'

/** Settings of the bot provider. */
export interface MeetingBotSettings {
  /** Recall.ai API key. */
  apiKey: string
  /** Region API base, e.g. `https://us-east-1.recall.ai/api/v1`. */
  apiBaseUrl: string
  /** Public base URL of this server (the bot connects back over wss). */
  publicBaseUrl: string
  /** Display name of the bot in the meeting. */
  botName: string
}

/** Audio event as delivered by the bot provider. */
interface BotAudioEvent {
  event?: string
  data?: {
    data?: {
      buffer?: string
      participant?: { id?: number | string; name?: string | null }
    }
  }
}

/** Sends bots to meetings and receives their audio. */
export class MeetingBotGateway {
  private readonly tokens = new Map<string, string>()

  /**
   * @param settings - Provider settings.
   * @param ingest - Stream opener.
   * @param log - Logger.
   */
  constructor(
    private readonly settings: MeetingBotSettings,
    private readonly ingest: AudioIngest,
    private readonly log: AgentLogger,
  ) {}

  /**
   * Sends a bot to a meeting on behalf of a room.
   *
   * @param room - Room that receives the audio.
   * @param meetingUrl - Join URL of the meeting.
   * @returns The provider's bot id.
   */
  async invite(room: RoomRuntime, meetingUrl: string): Promise<string> {
    const token = randomBytes(24).toString('hex')
    this.tokens.set(token, room.roomId)
    const socketUrl = `${this.settings.publicBaseUrl.replace(/^http/, 'ws')}/ws/bot/${room.roomId}?token=${token}`
    const response = await fetch(`${this.settings.apiBaseUrl}/bot/`, {
      method: 'POST',
      headers: {
        authorization: `Token ${this.settings.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: this.settings.botName,
        recording_config: {
          audio_separate_raw: {},
          realtime_endpoints: [
            { type: 'websocket', url: socketUrl, events: ['audio_separate_raw.data'] },
          ],
        },
      }),
    })
    if (!response.ok) {
      this.tokens.delete(token)
      throw new Error(
        `bot provider rejected the request: ${response.status} ${await response.text()}`,
      )
    }
    const bot = (await response.json()) as { id?: string }
    room.board.patchMeta({ captureMode: 'meetingBot' }, 'system')
    return bot.id ?? ''
  }

  /**
   * Checks the token of an incoming bot connection.
   *
   * @param roomId - Room in the URL.
   * @param token - Token in the URL.
   */
  isAuthorized(roomId: string, token: string): boolean {
    return this.tokens.get(token) === roomId
  }

  /**
   * Handles the bot's audio WebSocket.
   *
   * @param socket - Connection from the bot provider.
   * @param room - Target room.
   */
  handleConnection(socket: WebSocket, room: RoomRuntime): void {
    const participants = new ParticipantStreams(
      room.board,
      this.ingest,
      'meetingBot',
      'bot',
      this.log,
    )
    room.handleAudioStarted()
    socket.on('message', (data) => {
      let event: BotAudioEvent
      try {
        event = JSON.parse(data.toString()) as BotAudioEvent
      } catch {
        return
      }
      const payload = event.data?.data
      if (event.event !== 'audio_separate_raw.data' || !payload?.buffer) return
      const participantId = String(payload.participant?.id ?? 'unknown')
      participants.push(
        participantId,
        payload.participant?.name ?? '',
        new Uint8Array(Buffer.from(payload.buffer, 'base64')),
      )
    })
    socket.on('close', () => participants.close())
  }
}

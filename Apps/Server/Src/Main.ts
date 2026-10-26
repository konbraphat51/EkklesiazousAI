// Server entry point: loads configuration, composes services and starts listening.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AgentRoom } from './Agent/AgentRoom'
import { EventLog } from './Agent/EventLog'
import { AudioGateway } from './Audio/AudioGateway'
import { AudioIngest } from './Audio/AudioIngest'
import { loadConfigServer } from './Config/ConfigServer'
import { createServerHttp } from './Http/ServerHttp'
import { createProviders } from './Providers/ProviderFactory'
import { RoomRegistry } from './Rooms/RoomRegistry'
import { RoomRuntime } from './Rooms/RoomRuntime'
import { RoomStore } from './Rooms/RoomStore'
import { SyncHub } from './Sync/SyncHub'
import { ZoomRtmsGateway } from './Zoom/ZoomRtmsGateway'
import { MeetingBotGateway } from './Bots/MeetingBotGateway'

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main(): Promise<void> {
  const config = loadConfigServer(process.env, process.argv, serverDirectory)
  const logger = {
    info: (details: object, message: string) => console.info(message, details),
    warn: (details: object, message: string) => console.warn(message, details),
    error: (details: object, message: string) => console.error(message, details),
  }
  const providers = createProviders(config, logger)

  const registry = new RoomRegistry<RoomRuntime>(
    new RoomStore(path.join(config.dataDirectoryAbsolute, 'Rooms')),
    (roomId, board) =>
      new RoomRuntime(
        roomId,
        board,
        new AgentRoom(
          board,
          providers.toolkit,
          new EventLog(path.join(config.dataDirectoryAbsolute, 'Logs'), roomId),
        ),
      ),
  )
  const syncHub = new SyncHub(async (roomId) => (await registry.open(roomId))?.board.doc ?? null)
  const ingest = new AudioIngest(providers.recognizer, logger)
  const zoomGateway =
    config.ZOOM_CLIENT_ID && config.ZOOM_CLIENT_SECRET && config.ZOOM_WEBHOOK_SECRET_TOKEN
      ? new ZoomRtmsGateway(
          {
            clientId: config.ZOOM_CLIENT_ID,
            clientSecret: config.ZOOM_CLIENT_SECRET,
            webhookSecretToken: config.ZOOM_WEBHOOK_SECRET_TOKEN,
          },
          (keys) =>
            registry.listLive().find((room) => {
              const linked = room.board.readMeta().zoomMeetingId.replace(/\s+/g, '')
              return linked.length > 0 && keys.includes(linked)
            }),
          ingest,
          logger,
        )
      : null

  const botGateway = config.RECALL_API_KEY
    ? new MeetingBotGateway(
        {
          apiKey: config.RECALL_API_KEY,
          apiBaseUrl: config.RECALL_API_BASE_URL,
          publicBaseUrl: config.PUBLIC_BASE_URL,
          botName: config.MEETING_BOT_NAME,
        },
        ingest,
        logger,
      )
    : null

  const app = await createServerHttp({
    registry,
    syncHub,
    audioGateway: new AudioGateway(ingest, logger),
    zoomGateway,
    botGateway,
    capabilities: providers.capabilities,
    clientDistDirectory: config.clientDistDirectoryAbsolute,
  })
  await app.listen({ port: config.PORT, host: config.HOST })
  app.log.info(providers.capabilities, 'EkklesiazousAI server ready')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

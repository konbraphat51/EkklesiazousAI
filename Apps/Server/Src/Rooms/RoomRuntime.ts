// A live room: shared board plus its agent and demo player.
import type { DocumentBoard } from '@ekklesiazous/shared'
import type { AgentRoom } from '../Agent/AgentRoom'
import { DemoPlayer } from '../Demo/DemoPlayer'
import type { RoomMeeting } from './RoomRegistry'

/** Runtime of one room. */
export class RoomRuntime implements RoomMeeting {
  private readonly demo: DemoPlayer

  /**
   * @param roomId - Room identifier.
   * @param board - Shared board.
   * @param agent - The room's agent.
   */
  constructor(
    readonly roomId: string,
    readonly board: DocumentBoard,
    readonly agent: AgentRoom,
  ) {
    this.demo = new DemoPlayer(board)
  }

  /** Whether the scripted demo is playing. */
  get isDemoPlaying(): boolean {
    return this.demo.isPlaying
  }

  /** Starts the scripted demo meeting and lets the agent listen. */
  startDemo(): void {
    // the scripted meeting is denser than real talk, so the agent may volunteer more
    this.board.patchMeta({ captureMode: 'demo', proactivity: 'high' }, 'system')
    this.agent.setAgentState('listening')
    void this.demo.play()
  }

  /** Stops the scripted demo meeting. */
  stopDemo(): void {
    this.demo.stop()
  }

  /** Called when real audio starts flowing: the agent starts listening if it was idle. */
  handleAudioStarted(): void {
    if (this.board.readMeta().agentState === 'idle') this.agent.setAgentState('listening')
  }

  dispose(): void {
    this.demo.stop()
    this.agent.dispose()
  }
}

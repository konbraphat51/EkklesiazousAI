// Watches transcript activity on the board and reports new segments, interim speech and breakpoints.
import type { CaptionLive, DocumentBoard, TranscriptSegment } from '@ekklesiazous/shared'

const BREAKPOINT_SILENCE_MS = 700

/** Listener of conversation events. */
export interface ConversationListener {
  /** New finalized segments, in order. */
  onSegments(segments: TranscriptSegment[]): void
  /** Interim speech changed on some stream. */
  onCaption(caption: CaptionLive): void
  /** A natural pause or a speaker change happened. */
  onBreakpoint(): void
}

/** Turns board changes into conversation events. */
export class ConversationPulse {
  private segmentCountSeen: number
  private lastSpeakerId: string | null = null
  private silenceTimer: NodeJS.Timeout | null = null
  private readonly unsubscribe: () => void

  /**
   * @param board - Board to observe.
   * @param listener - Receiver of events.
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly listener: ConversationListener,
  ) {
    // segments already on the board when the agent starts are history, not news
    this.segmentCountSeen = board.listSegments().length
    this.unsubscribe = board.observe((changed) => {
      if (changed.has('segments')) this.handleSegments()
      if (changed.has('captions')) this.handleCaptions()
    })
  }

  /** Stops observing. */
  dispose(): void {
    this.unsubscribe()
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
  }

  private handleSegments(): void {
    const segments = this.board.listSegments()
    const fresh = segments.slice(this.segmentCountSeen)
    this.segmentCountSeen = segments.length
    if (fresh.length === 0) return
    this.listener.onSegments(fresh)
    const speakerId = fresh.at(-1)!.speakerId
    const isSpeakerChange = this.lastSpeakerId !== null && this.lastSpeakerId !== speakerId
    this.lastSpeakerId = speakerId
    if (isSpeakerChange) this.listener.onBreakpoint()
    this.armSilenceTimer()
  }

  private handleCaptions(): void {
    const captions = this.board.listCaptions()
    for (const caption of captions) this.listener.onCaption(caption)
    this.armSilenceTimer()
  }

  // a breakpoint fires once speech activity has been quiet for a moment
  private armSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null
      if (this.board.listCaptions().length === 0) this.listener.onBreakpoint()
      else this.armSilenceTimer()
    }, BREAKPOINT_SILENCE_MS)
  }
}

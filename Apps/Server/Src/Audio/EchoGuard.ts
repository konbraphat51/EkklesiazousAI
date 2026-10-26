// Drops microphone segments that merely echo what another stream already transcribed (a host listening
// on speakers re-records remote voices; the meeting-tab stream has them with the right speaker).
import type { DocumentBoard, TranscriptSegment } from '@ekklesiazous/shared'
import { computeSimilarity } from '../Agent/TextSimilarity'

const HOLD_MS = 1500
const ACTIVITY_WINDOW_MS = 30_000
const MATCH_WINDOW_MS = 6000
const ECHO_SIMILARITY = 0.6

/** Filters echoed segments of single-speaker microphone streams. */
export class EchoGuard {
  /**
   * @param board - Board holding the other streams' segments.
   * @param now - Clock (injectable for tests).
   * @param schedule - Timer (injectable for tests).
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly now: () => number = Date.now,
    private readonly schedule: (callback: () => void, ms: number) => void = (callback, ms) =>
      void setTimeout(callback, ms),
  ) {}

  /**
   * Appends a segment unless it duplicates another stream's speech.
   *
   * @param segment - Finalized segment.
   * @param isSingleSpeaker - Whether the segment comes from a named microphone stream.
   * @param append - Writes the segment to the board.
   */
  admit(
    segment: TranscriptSegment,
    isSingleSpeaker: boolean,
    append: (segment: TranscriptSegment) => void,
  ): void {
    if (!isSingleSpeaker || !this.isOtherStreamActive(segment.sourceId)) {
      append(segment)
      return
    }
    // wait briefly so the meeting-tab version (usually earlier) can land first
    this.schedule(() => {
      if (!this.isEcho(segment)) append(segment)
    }, HOLD_MS)
  }

  private isOtherStreamActive(sourceId: string): boolean {
    const cutoff = this.now() - ACTIVITY_WINDOW_MS
    const hasRecentSegment = this.board
      .listSegments()
      .some((segment) => segment.sourceId !== sourceId && segment.finalizedAt >= cutoff)
    const hasCaption = this.board.listCaptions().some((caption) => caption.sourceId !== sourceId)
    return hasRecentSegment || hasCaption
  }

  private isEcho(segment: TranscriptSegment): boolean {
    return this.board
      .listSegments()
      .some(
        (other) =>
          other.sourceId !== segment.sourceId &&
          Math.abs(other.finalizedAt - segment.finalizedAt) <= MATCH_WINDOW_MS &&
          computeSimilarity(other.text, segment.text) >= ECHO_SIMILARITY,
      )
  }
}

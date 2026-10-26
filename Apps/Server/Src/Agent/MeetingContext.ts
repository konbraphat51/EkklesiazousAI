// Renders the meeting board into prompt context, ordered so that stable parts form a cacheable prefix.
import type { DocumentBoard, TranscriptSegment } from '@ekklesiazous/shared'

const CHUNK_SEGMENTS = 20
const WINDOW_SEGMENTS = 240

/** Transcript rendered as chunks; complete chunks never change and can be cached. */
export interface TranscriptRendered {
  /** Chunk texts in chronological order. */
  blocks: string[]
  /** Index of the last complete (stable) chunk, or -1. */
  cacheIndex: number
}

/** Read-only view of the meeting used to build prompts. */
export class MeetingContext {
  /**
   * @param board - The room's shared board.
   */
  constructor(private readonly board: DocumentBoard) {}

  /**
   * Renders the transcript window as fixed-size chunks.
   *
   * @param maxSegments - Window size; the window start moves in whole chunks to keep prefixes stable.
   */
  renderTranscript(maxSegments = WINDOW_SEGMENTS): TranscriptRendered {
    const segments = this.board.listSegments()
    const overflow = Math.max(0, segments.length - maxSegments)
    const windowStart = Math.ceil(overflow / CHUNK_SEGMENTS) * CHUNK_SEGMENTS
    const blocks: string[] = []
    let cacheIndex = -1
    for (let start = windowStart; start < segments.length; start += CHUNK_SEGMENTS) {
      const chunk = segments.slice(start, start + CHUNK_SEGMENTS)
      const header = start === windowStart ? 'Transcript ([id] speakerId mm:ss text):\n' : ''
      blocks.push(header + chunk.map((segment) => formatSegment(segment)).join('\n'))
      if (chunk.length === CHUNK_SEGMENTS) cacheIndex = blocks.length - 1
    }
    if (blocks.length === 0) blocks.push('Transcript: (nothing said yet)')
    return { blocks, cacheIndex }
  }

  /**
   * Renders the most recent utterances (for writers that need only local context).
   *
   * @param count - Number of utterances.
   */
  renderRecent(count: number): string {
    const lines = this.board
      .listSegments()
      .slice(-count)
      .map((segment) => formatSegment(segment))
    return `Recent transcript ([id] speakerId mm:ss text):\n${lines.join('\n') || '(nothing yet)'}`
  }

  /** Renders volatile meeting state: speakers, topics, existing insights, glossary, summary. */
  renderState(): string {
    const meta = this.board.readMeta()
    const speakers = this.board
      .listSpeakers()
      .map((speaker) => `${speaker.id} = ${speaker.label}`)
      .join('; ')
    const topics = this.board
      .listTopics()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((topic) => `[${topic.id}] ${topic.label}`)
      .join('; ')
    const insights = this.board
      .listInsights()
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-40)
      .map((insight) => `[${insight.id}] ${insight.kind}: ${insight.title}`)
      .join('\n')
    const glossary = this.board
      .listGlossary()
      .map((entry) => entry.term)
      .join(', ')
    return [
      `Meeting title: ${meta.title}`,
      `Speakers: ${speakers || '(none yet)'}`,
      `Topics: ${topics || '(none yet)'}`,
      `Existing insights (do not duplicate):\n${insights || '(none yet)'}`,
      `Glossary terms already explained: ${glossary || '(none)'}`,
      meta.summary ? `Meeting so far: ${meta.summary}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  /**
   * Gets segments by id, in transcript order.
   *
   * @param ids - Segment ids.
   */
  findSegments(ids: readonly string[]): TranscriptSegment[] {
    const wanted = new Set(ids)
    return this.board.listSegments().filter((segment) => wanted.has(segment.id))
  }

  /**
   * Gets segments finalized within the last milliseconds.
   *
   * @param spanMs - Look-back span.
   * @param now - Current time (epoch ms).
   */
  findSegmentsRecent(spanMs: number, now: number): TranscriptSegment[] {
    return this.board.listSegments().filter((segment) => now - segment.finalizedAt <= spanMs)
  }

  /**
   * Joins segments into a quotable string.
   *
   * @param segments - Segments to quote.
   */
  quote(segments: TranscriptSegment[]): string {
    return segments.map((segment) => segment.text).join(' ')
  }
}

/**
 * Formats a meeting offset as mm:ss.
 *
 * @param ms - Offset from meeting start.
 */
export function formatOffset(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatSegment(segment: TranscriptSegment): string {
  return `[${segment.id}] ${segment.speakerId} ${formatOffset(segment.startMs)} ${segment.text}`
}

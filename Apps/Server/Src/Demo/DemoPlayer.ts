// Replays the scripted meeting into a board as if a recognizer were transcribing it live.
import { nanoid } from 'nanoid'
import type { DocumentBoard } from '@ekklesiazous/shared'
import { DEMO_LINES, DEMO_SPEAKERS, type DemoLine } from './DemoScript'

const SOURCE_ID = 'demo'
const GAP_BETWEEN_LINES_MS = 900
const FINALIZE_DELAY_MS = 300
const ENGLISH_WORD_MS = 330
const JAPANESE_CHARACTER_MS = 120

/** Plays the demo script into a board. */
export class DemoPlayer {
  private isPlayingFlag = false
  private generation = 0

  /**
   * @param board - Board to write captions and segments to.
   * @param speed - Playback speed multiplier (2 = twice as fast).
   */
  constructor(
    private readonly board: DocumentBoard,
    private readonly speed = 1,
  ) {}

  /** Whether playback is running. */
  get isPlaying(): boolean {
    return this.isPlayingFlag
  }

  /**
   * Starts playback from the first line (no-op while playing).
   *
   * @returns Promise resolved when playback ends or is stopped.
   */
  async play(): Promise<void> {
    if (this.isPlayingFlag) return
    this.isPlayingFlag = true
    const generation = ++this.generation
    for (const [key, label] of Object.entries(DEMO_SPEAKERS)) {
      this.board.upsertSpeaker(
        { id: `demo:${key}`, label, colorIndex: 'ABC'.indexOf(key) },
        'recognizer',
      )
    }
    const meta = this.board.readMeta()
    const startedAt = meta.startedAt ?? Date.now()
    if (!meta.startedAt) this.board.patchMeta({ startedAt }, 'system')

    for (const line of DEMO_LINES) {
      if (generation !== this.generation) return
      await this.speak(line, startedAt, generation)
      await this.wait(GAP_BETWEEN_LINES_MS)
    }
    this.isPlayingFlag = false
  }

  /** Stops playback after the current step. */
  stop(): void {
    this.generation += 1
    this.isPlayingFlag = false
    this.board.setCaption(SOURCE_ID, null)
  }

  private async speak(line: DemoLine, startedAt: number, generation: number): Promise<void> {
    const speakerId = `demo:${line.speaker}`
    const pieces = splitForCaption(line)
    const startMs = Date.now() - startedAt
    let text = ''
    for (const piece of pieces) {
      if (generation !== this.generation) return
      text += piece
      this.board.setCaption(SOURCE_ID, {
        sourceId: SOURCE_ID,
        speakerId,
        text,
        language: line.language,
        updatedAt: Date.now(),
      })
      await this.wait(
        line.language === 'en' ? ENGLISH_WORD_MS : JAPANESE_CHARACTER_MS * piece.length,
      )
    }
    await this.wait(FINALIZE_DELAY_MS)
    if (generation !== this.generation) return
    this.board.doc.transact(() => {
      this.board.setCaption(SOURCE_ID, null)
      this.board.appendSegment({
        id: nanoid(12),
        speakerId,
        text: line.text,
        language: line.language,
        sourceId: SOURCE_ID,
        startMs,
        endMs: Date.now() - startedAt,
        finalizedAt: Date.now(),
      })
    }, 'recognizer')
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms / this.speed))
  }
}

function splitForCaption(line: DemoLine): string[] {
  if (line.language === 'en') return line.text.split(/(?<= )/)
  // Japanese has no spaces; reveal a few characters at a time
  const pieces: string[] = []
  for (let index = 0; index < line.text.length; index += 3)
    pieces.push(line.text.slice(index, index + 3))
  return pieces
}

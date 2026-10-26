// Maps provider speaker labels and participant names to board speakers, registering new ones.
import type { DocumentBoard } from '@ekklesiazous/shared'

/** Resolves and registers speakers of one room. */
export class SpeakerDirectory {
  /**
   * @param board - Board holding the speakers.
   */
  constructor(private readonly board: DocumentBoard) {}

  /**
   * Resolves a diarized speaker of a stream, creating "Speaker N" on first sight.
   *
   * @param sourceId - Audio stream id.
   * @param label - Provider speaker label, or null when unknown.
   */
  resolveDiarized(sourceId: string, label: string | null): string {
    const id = `${sourceId}:${label ?? '?'}`
    if (!this.has(id)) {
      const count = this.board.listSpeakers().length
      this.register(id, label === null ? 'Speaker ?' : `Speaker ${count + 1}`)
    }
    return id
  }

  /**
   * Resolves a known participant (per-participant streams), creating them on first sight.
   *
   * @param name - Participant display name.
   */
  resolveNamed(name: string): string {
    const slug = name
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\s:|]+/g, '-')
    const id = `participant:${slug || 'anonymous'}`
    if (!this.has(id)) this.register(id, name.trim() || 'Participant')
    return id
  }

  private has(id: string): boolean {
    return this.board.listSpeakers().some((speaker) => speaker.id === id)
  }

  private register(id: string, label: string): void {
    this.board.upsertSpeaker(
      { id, label, colorIndex: this.board.listSpeakers().length },
      'recognizer',
    )
  }
}

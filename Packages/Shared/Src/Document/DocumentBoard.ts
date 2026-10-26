// Typed accessor over the Yjs document that holds one meeting board; shared by client and server.
import * as Y from 'yjs'
import { INSIGHT_KINDS, type Insight, type InsightKind } from '../Model/Insight'
import type { IssueNode } from '../Model/IssueNode'
import type { MeetingMeta } from '../Model/MeetingMeta'
import type { Note } from '../Model/Note'
import type { Placement } from '../Model/Placement'
import type { Speaker } from '../Model/Speaker'
import type { Topic } from '../Model/Topic'
import type { CaptionLive, TranscriptSegment } from '../Model/TranscriptSegment'
import type { VariantId } from '../Presentation/VariantId'

/** Names of the top-level shared collections. */
export type CollectionName =
  | 'meta'
  | 'speakers'
  | 'segments'
  | 'captions'
  | 'insights'
  | 'topics'
  | 'issues'
  | 'notes'
  | 'placements'

/** Every collection name. */
export const COLLECTION_NAMES: readonly CollectionName[] = [
  'meta',
  'speakers',
  'segments',
  'captions',
  'insights',
  'topics',
  'issues',
  'notes',
  'placements',
]

/** Transaction origins, so observers can tell who changed the document. */
export type ChangeOrigin = 'agent' | 'recognizer' | 'participant' | 'system'

/**
 * Builds the meta values of a freshly created room.
 *
 * @param now - Creation time (epoch ms).
 */
export function createMeetingMetaDefault(now: number): MeetingMeta {
  const kindsEnabled = Object.fromEntries(INSIGHT_KINDS.map((kind) => [kind, true])) as Record<
    InsightKind,
    boolean
  >
  return {
    title: 'Untitled meeting',
    createdAt: now,
    startedAt: null,
    captureMode: 'roomMicrophone',
    languageInsight: 'auto',
    variantDefault: 'timeline',
    agentState: 'idle',
    kindsEnabled,
  }
}

/** Typed read/write access to a meeting board stored in a Y.Doc. */
export class DocumentBoard {
  /**
   * @param doc - The Yjs document; created empty if omitted.
   */
  constructor(public readonly doc: Y.Doc = new Y.Doc()) {}

  /** Reads meta values, filling defaults for keys that were never written. */
  readMeta(): MeetingMeta {
    const stored = this.mapOf<unknown>('meta').toJSON() as Partial<MeetingMeta>
    const defaults = createMeetingMetaDefault(stored.createdAt ?? 0)
    return {
      ...defaults,
      ...stored,
      kindsEnabled: { ...defaults.kindsEnabled, ...stored.kindsEnabled },
    }
  }

  /**
   * Writes the given meta values; other keys stay untouched so concurrent edits merge.
   *
   * @param patch - Meta values to overwrite.
   * @param origin - Who makes the change.
   */
  patchMeta(patch: Partial<MeetingMeta>, origin: ChangeOrigin = 'participant'): void {
    this.doc.transact(() => {
      const meta = this.mapOf<unknown>('meta')
      for (const [key, value] of Object.entries(patch)) meta.set(key, value)
    }, origin)
  }

  /** Lists known speakers. */
  listSpeakers(): Speaker[] {
    return valuesOf(this.mapOf<Speaker>('speakers'))
  }

  /**
   * Inserts or replaces a speaker.
   *
   * @param speaker - Speaker to store.
   * @param origin - Who makes the change.
   */
  upsertSpeaker(speaker: Speaker, origin: ChangeOrigin = 'participant'): void {
    this.doc.transact(() => this.mapOf<Speaker>('speakers').set(speaker.id, speaker), origin)
  }

  /** Lists finalized transcript segments in arrival order. */
  listSegments(): TranscriptSegment[] {
    return this.doc.getArray<TranscriptSegment>('segments').toArray()
  }

  /**
   * Appends a finalized transcript segment.
   *
   * @param segment - Segment to append.
   */
  appendSegment(segment: TranscriptSegment): void {
    this.doc.transact(
      () => this.doc.getArray<TranscriptSegment>('segments').push([segment]),
      'recognizer',
    )
  }

  /** Lists live (interim) captions, one per active audio stream. */
  listCaptions(): CaptionLive[] {
    return valuesOf(this.mapOf<CaptionLive>('captions'))
  }

  /**
   * Sets or clears the live caption of an audio stream.
   *
   * @param sourceId - Audio stream identifier.
   * @param caption - New caption, or null to clear.
   */
  setCaption(sourceId: string, caption: CaptionLive | null): void {
    this.doc.transact(() => {
      const captions = this.mapOf<CaptionLive>('captions')
      if (caption) captions.set(sourceId, caption)
      else captions.delete(sourceId)
    }, 'recognizer')
  }

  /** Lists insights in no particular order. */
  listInsights(): Insight[] {
    return valuesOf(this.mapOf<Insight>('insights'))
  }

  /**
   * Gets one insight.
   *
   * @param id - Insight identifier.
   */
  getInsight(id: string): Insight | undefined {
    return this.mapOf<Insight>('insights').get(id)
  }

  /**
   * Inserts or replaces an insight.
   *
   * @param insight - Insight to store.
   * @param origin - Who makes the change.
   */
  upsertInsight(insight: Insight, origin: ChangeOrigin = 'agent'): void {
    this.doc.transact(() => this.mapOf<Insight>('insights').set(insight.id, insight), origin)
  }

  /**
   * Overwrites some fields of an existing insight; no-op if the insight is gone.
   *
   * @param id - Insight identifier.
   * @param patch - Fields to overwrite.
   * @param origin - Who makes the change.
   */
  patchInsight(id: string, patch: Partial<Insight>, origin: ChangeOrigin = 'agent'): void {
    this.doc.transact(() => {
      const insights = this.mapOf<Insight>('insights')
      const current = insights.get(id)
      if (current) insights.set(id, { ...current, ...patch, updatedAt: Date.now() })
    }, origin)
  }

  /** Lists topics. */
  listTopics(): Topic[] {
    return valuesOf(this.mapOf<Topic>('topics'))
  }

  /**
   * Inserts or replaces a topic.
   *
   * @param topic - Topic to store.
   */
  upsertTopic(topic: Topic): void {
    this.doc.transact(() => this.mapOf<Topic>('topics').set(topic.id, topic), 'agent')
  }

  /** Lists issue-map nodes. */
  listIssues(): IssueNode[] {
    return valuesOf(this.mapOf<IssueNode>('issues'))
  }

  /**
   * Inserts or replaces an issue-map node.
   *
   * @param node - Node to store.
   * @param origin - Who makes the change.
   */
  upsertIssue(node: IssueNode, origin: ChangeOrigin = 'agent'): void {
    this.doc.transact(() => this.mapOf<IssueNode>('issues').set(node.id, node), origin)
  }

  /**
   * Removes an issue-map node.
   *
   * @param id - Node identifier.
   */
  removeIssue(id: string): void {
    this.doc.transact(() => this.mapOf<IssueNode>('issues').delete(id), 'participant')
  }

  /** Lists sticky notes. */
  listNotes(): Note[] {
    return valuesOf(this.mapOf<Note>('notes'))
  }

  /**
   * Inserts or replaces a sticky note.
   *
   * @param note - Note to store.
   */
  upsertNote(note: Note): void {
    this.doc.transact(() => this.mapOf<Note>('notes').set(note.id, note), 'participant')
  }

  /**
   * Removes a sticky note.
   *
   * @param id - Note identifier.
   */
  removeNote(id: string): void {
    this.doc.transact(() => this.mapOf<Note>('notes').delete(id), 'participant')
  }

  /**
   * Lists manual placements of one variant, keyed by item id.
   *
   * @param variant - Presentation variant.
   */
  listPlacements(variant: VariantId): Map<string, Placement> {
    const placements = new Map<string, Placement>()
    const prefix = `${variant}|`
    for (const [key, value] of this.mapOf<Placement>('placements').entries()) {
      if (key.startsWith(prefix)) placements.set(key.slice(prefix.length), value)
    }
    return placements
  }

  /**
   * Stores or clears the manual placement of an item in one variant.
   *
   * @param variant - Presentation variant.
   * @param itemId - Canvas item identifier.
   * @param placement - New position, or null to return to automatic layout.
   */
  setPlacement(variant: VariantId, itemId: string, placement: Placement | null): void {
    this.doc.transact(() => {
      const placements = this.mapOf<Placement>('placements')
      const key = `${variant}|${itemId}`
      if (placement) placements.set(key, placement)
      else placements.delete(key)
    }, 'participant')
  }

  /**
   * Subscribes to changes; the callback receives which collections changed in one transaction.
   *
   * @param callback - Invoked after each transaction that touched the board.
   * @returns Function that unsubscribes.
   */
  observe(callback: (changed: Set<CollectionName>, origin: unknown) => void): () => void {
    const handler = (transaction: Y.Transaction): void => {
      const changed = new Set<CollectionName>()
      for (const type of transaction.changed.keys()) {
        const name = this.collectionNameOf(type)
        if (name) changed.add(name)
      }
      if (changed.size > 0) callback(changed, transaction.origin)
    }
    this.doc.on('afterTransaction', handler)
    return () => this.doc.off('afterTransaction', handler)
  }

  private mapOf<T>(name: Exclude<CollectionName, 'segments'>): Y.Map<T> {
    return this.doc.getMap<T>(name)
  }

  private collectionNameOf(type: unknown): CollectionName | null {
    for (const name of COLLECTION_NAMES) {
      const candidate = name === 'segments' ? this.doc.getArray(name) : this.doc.getMap(name)
      if (candidate === type) return name
    }
    return null
  }
}

function valuesOf<T>(map: Y.Map<T>): T[] {
  return Array.from(map.values())
}

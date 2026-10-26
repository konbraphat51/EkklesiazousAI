// Reactive snapshots of the shared board, refreshed per collection when Yjs reports changes.
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import type {
  CaptionLive,
  CollectionName,
  DocumentBoard,
  GlossaryEntry,
  Insight,
  IssueNode,
  MeetingMeta,
  Note,
  Speaker,
  Topic,
  TranscriptSegment,
} from '@ekklesiazous/shared'

/** Reactive views of every board collection. */
export interface BoardState {
  meta: ShallowRef<MeetingMeta>
  speakers: ShallowRef<Speaker[]>
  segments: ShallowRef<TranscriptSegment[]>
  captions: ShallowRef<CaptionLive[]>
  insights: ShallowRef<Insight[]>
  topics: ShallowRef<Topic[]>
  issues: ShallowRef<IssueNode[]>
  notes: ShallowRef<Note[]>
  glossary: ShallowRef<GlossaryEntry[]>
  confusion: ShallowRef<Map<string, number>>
  /** Increments whenever placements change (placements are read per layout). */
  placementsVersion: ShallowRef<number>
}

/**
 * Creates reactive board views bound to the current effect scope.
 *
 * @param board - Board to observe.
 */
export function useBoardState(board: DocumentBoard): BoardState {
  const state: BoardState = {
    meta: shallowRef(board.readMeta()),
    speakers: shallowRef(board.listSpeakers()),
    segments: shallowRef(board.listSegments()),
    captions: shallowRef(board.listCaptions()),
    insights: shallowRef(board.listInsights()),
    topics: shallowRef(board.listTopics()),
    issues: shallowRef(board.listIssues()),
    notes: shallowRef(board.listNotes()),
    glossary: shallowRef(board.listGlossary()),
    confusion: shallowRef(board.readConfusion()),
    placementsVersion: shallowRef(0),
  }
  const refresh: Record<CollectionName, () => void> = {
    meta: () => (state.meta.value = board.readMeta()),
    speakers: () => (state.speakers.value = board.listSpeakers()),
    segments: () => (state.segments.value = board.listSegments()),
    captions: () => (state.captions.value = board.listCaptions()),
    insights: () => (state.insights.value = board.listInsights()),
    topics: () => (state.topics.value = board.listTopics()),
    issues: () => (state.issues.value = board.listIssues()),
    notes: () => (state.notes.value = board.listNotes()),
    glossary: () => (state.glossary.value = board.listGlossary()),
    confusion: () => (state.confusion.value = board.readConfusion()),
    placements: () => (state.placementsVersion.value += 1),
  }
  const unsubscribe = board.observe((changed) => {
    for (const name of changed) refresh[name]()
  })
  onScopeDispose(unsubscribe)
  return state
}

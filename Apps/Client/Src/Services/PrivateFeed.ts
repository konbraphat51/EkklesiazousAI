// The participant's private results (clarifications, recaps, private research); never written to the
// shared board.
import { reactive } from 'vue'
import type {
  Clarification,
  ClarificationAskRequest,
  Insight,
  ResearchCommandRequest,
} from '@ekklesiazous/shared'
import { api } from './ApiClient'

/** One private item in the drawer. */
export type PrivateItem =
  | { type: 'clarification'; id: string; value: Clarification; isShared: boolean }
  | { type: 'insight'; id: string; value: Insight; isShared: false }

/** Reactive list of private items with the actions that create them. */
export class PrivateFeed {
  /** Newest first. */
  readonly items: PrivateItem[] = reactive([])
  /** Increments whenever a new request starts (the drawer opens on change). */
  readonly attention = reactive({ count: 0 })

  /**
   * @param roomId - Room the requests go to.
   */
  constructor(private readonly roomId: string) {}

  /**
   * Asks privately for an explanation or a recap.
   *
   * @param request - The request.
   */
  async askClarification(request: ClarificationAskRequest): Promise<void> {
    const key = `pending-${Date.now()}`
    this.attention.count += 1
    let id = key
    await api.askClarification(this.roomId, request, (clarification) => {
      const index = this.items.findIndex((item) => item.id === id)
      const item: PrivateItem = {
        type: 'clarification',
        id: clarification.id,
        value: clarification,
        isShared: false,
      }
      if (index >= 0) this.items.splice(index, 1, item)
      else this.items.unshift(item)
      id = clarification.id
    })
  }

  /**
   * Runs a research command whose result only this participant sees.
   *
   * @param request - The command (isPrivate must be true).
   */
  async runPrivateCommand(request: ResearchCommandRequest): Promise<void> {
    this.attention.count += 1
    await api.issueCommandPrivate(this.roomId, request, (insight) => {
      const index = this.items.findIndex((item) => item.id === insight.id)
      const item: PrivateItem = { type: 'insight', id: insight.id, value: insight, isShared: false }
      if (index >= 0) this.items.splice(index, 1, item)
      else this.items.unshift(item)
    })
  }

  /**
   * Shares a clarification anonymously on the board.
   *
   * @param clarificationId - Clarification to share.
   */
  async share(clarificationId: string): Promise<void> {
    await api.shareClarification(this.roomId, clarificationId)
    const item = this.items.find((candidate) => candidate.id === clarificationId)
    if (item?.type === 'clarification') item.isShared = true
  }

  /**
   * Removes an item from the drawer.
   *
   * @param id - Item id.
   */
  remove(id: string): void {
    const index = this.items.findIndex((item) => item.id === id)
    if (index >= 0) this.items.splice(index, 1)
  }
}

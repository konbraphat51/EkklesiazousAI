// Lookup of layout strategies by id.
import type { LayoutId } from '@ekklesiazous/shared'
import { LayoutIssueMap } from './LayoutIssueMap'
import { LayoutPeriphery } from './LayoutPeriphery'
import { LayoutTimeline } from './LayoutTimeline'
import { LayoutTopicMap } from './LayoutTopicMap'
import type { LayoutStrategy } from './LayoutTypes'

const LAYOUTS: Record<LayoutId, LayoutStrategy> = {
  timeline: new LayoutTimeline(),
  topicMap: new LayoutTopicMap(),
  issueMap: new LayoutIssueMap(),
  periphery: new LayoutPeriphery(),
}

/**
 * Gets the strategy of a layout.
 *
 * @param id - Layout id.
 */
export function getLayout(id: LayoutId): LayoutStrategy {
  return LAYOUTS[id]
}

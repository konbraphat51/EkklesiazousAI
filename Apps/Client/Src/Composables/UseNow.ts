// A reactive clock that ticks at a given interval (for ages, fades and the timeline "now").
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

/**
 * Returns the current time, refreshed every interval.
 *
 * @param intervalMs - Tick interval.
 */
export function useNow(intervalMs: number): ShallowRef<number> {
  const now = shallowRef(Date.now())
  const timer = window.setInterval(() => (now.value = Date.now()), intervalMs)
  onScopeDispose(() => window.clearInterval(timer))
  return now
}

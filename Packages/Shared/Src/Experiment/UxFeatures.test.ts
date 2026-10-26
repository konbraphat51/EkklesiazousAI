// Tests for UX feature resolution (room defaults, participant overrides, locking).
import { describe, expect, it } from 'vitest'
import { createUxSettingsDefault, resolveUxSettings } from './UxFeatures'

describe('resolveUxSettings', () => {
  it('uses the first option of every feature by default', () => {
    const defaults = createUxSettingsDefault()
    expect(defaults.layout).toBe('timeline')
    expect(defaults.disclosure).toBe('progressive')
    expect(defaults.deliveryTiming).toBe('breakpoint')
  })

  it('applies participant overrides only to participant-scoped features', () => {
    const resolved = resolveUxSettings(
      { layout: 'issueMap', deliveryTiming: 'digest' },
      { layout: 'periphery', deliveryTiming: 'immediate' },
      false,
    )
    expect(resolved.layout).toBe('periphery')
    expect(resolved.deliveryTiming).toBe('digest')
  })

  it('ignores overrides when the room is locked and invalid values always', () => {
    const resolved = resolveUxSettings(
      { layout: 'issueMap', disclosure: 'bogus' as never },
      { layout: 'periphery' },
      true,
    )
    expect(resolved.layout).toBe('issueMap')
    expect(resolved.disclosure).toBe('progressive')
  })
})

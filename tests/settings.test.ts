import { describe, it, expect } from 'vitest'
import type { AppSettings } from '../shared/types'

// Pure logic tests for settings overlay position fields.
// These tests validate the AppSettings type contract and the
// merge/default pattern used in settings.ts — without importing
// Electron's `app` module (which requires a running Electron environment).

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  overlayVisible: true,
  summonerName: '',
  overlayTheme: 'lol-native',
  aiModel: 'claude-sonnet-4-6',
  coachingIntervalSecs: 90,
  eventCoachingEnabled: true,
  eventCoachingSensitivity: 'major',
  showLiveStats: true,
  showEventFeed: true,
  showMatchupTip: true,
  overlayX: undefined,
  overlayY: undefined
}

function mergeWithDefaults(saved: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...saved }
}

describe('AppSettings overlay position fields', () => {
  it('defaults overlayX and overlayY to undefined', () => {
    expect(DEFAULT_SETTINGS.overlayX).toBeUndefined()
    expect(DEFAULT_SETTINGS.overlayY).toBeUndefined()
  })

  it('preserves saved overlayX and overlayY when merging with defaults', () => {
    const saved: Partial<AppSettings> = { overlayX: 120, overlayY: 80 }
    const merged = mergeWithDefaults(saved)
    expect(merged.overlayX).toBe(120)
    expect(merged.overlayY).toBe(80)
  })

  it('falls back to undefined when saved settings omit overlay position', () => {
    const saved: Partial<AppSettings> = { anthropicApiKey: 'key-abc' }
    const merged = mergeWithDefaults(saved)
    expect(merged.overlayX).toBeUndefined()
    expect(merged.overlayY).toBeUndefined()
  })

  it('correctly round-trips position through JSON serialization', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, overlayX: 300, overlayY: 150 }
    const serialized = JSON.stringify(settings)
    const parsed: AppSettings = JSON.parse(serialized)
    expect(parsed.overlayX).toBe(300)
    expect(parsed.overlayY).toBe(150)
  })

  it('saves updated position immutably via spread', () => {
    const original: AppSettings = { ...DEFAULT_SETTINGS }
    const updated: AppSettings = { ...original, overlayX: 500, overlayY: 200 }
    // Original must not be mutated
    expect(original.overlayX).toBeUndefined()
    expect(original.overlayY).toBeUndefined()
    expect(updated.overlayX).toBe(500)
    expect(updated.overlayY).toBe(200)
  })
})

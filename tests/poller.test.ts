import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractRecentEvents,
  computeTeamGoldDiff,
  detectMeaningfulChange
} from '../electron/main/poller'
import type { GameState } from '../shared/types'

// Fixtures
const mockEvents = [
  { EventName: 'DragonKill', EventTime: 300 },
  { EventName: 'TurretKilled', EventTime: 310 },
  { EventName: 'BaronKill', EventTime: 400 },
  { EventName: 'MinionsSpawning', EventTime: 0 },
  { EventName: 'ChampionKill', EventTime: 390 }
]

const mockPlayers = [
  { summonerName: 'TestPlayer', team: 'ORDER', currentGold: 3000, championName: 'Zed', position: 'MID', scores: { kills: 5, deaths: 1, assists: 2 } },
  { summonerName: 'Ally2', team: 'ORDER', currentGold: 2500, championName: 'Jinx', position: 'BOT', scores: { kills: 3, deaths: 0, assists: 4 } },
  { summonerName: 'Enemy1', team: 'CHAOS', currentGold: 2000, championName: 'Ahri', position: 'MID', scores: { kills: 2, deaths: 2, assists: 1 } },
  { summonerName: 'Enemy2', team: 'CHAOS', currentGold: 1800, championName: 'Caitlyn', position: 'BOT', scores: { kills: 1, deaths: 3, assists: 0 } }
]

const baseGameState: GameState = {
  champion: 'Zed',
  role: 'MID',
  gameTime: '10:00',
  kills: 5,
  deaths: 1,
  assists: 2,
  gold: 3000,
  teamGoldDiff: 1700,
  recentEvents: ['DragonKill', 'TurretKilled'],
  summonerName: 'TestPlayer'
}

describe('extractRecentEvents', () => {
  it('returns only relevant events within last 120s', () => {
    const result = extractRecentEvents(mockEvents, 420)
    expect(result).toContain('DragonKill')
    expect(result).toContain('TurretKilled')
    expect(result).toContain('BaronKill')
    expect(result).toContain('ChampionKill')
    expect(result).not.toContain('MinionsSpawning')
  })

  it('returns at most 10 events', () => {
    const manyEvents = Array.from({ length: 20 }, (_, i) => ({
      EventName: 'DragonKill',
      EventTime: i * 10
    }))
    const result = extractRecentEvents(manyEvents, 500)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('excludes events older than 120 seconds', () => {
    const result = extractRecentEvents(mockEvents, 500)
    // DragonKill at 300, gameTime 500 → 200s ago → excluded
    expect(result).not.toContain('DragonKill')
  })
})

describe('computeTeamGoldDiff', () => {
  it('computes positive diff when ally team is ahead', () => {
    const diff = computeTeamGoldDiff(mockPlayers, 'TestPlayer')
    // ORDER: 3000 + 2500 = 5500, CHAOS: 2000 + 1800 = 3800 → diff = 1700
    expect(diff).toBe(1700)
  })

  it('returns 0 when summoner not found', () => {
    const diff = computeTeamGoldDiff(mockPlayers, 'UnknownPlayer')
    expect(diff).toBe(0)
  })

  it('computes negative diff when enemy team is ahead', () => {
    // Give enemies more gold than allies
    const enemyAheadPlayers = [
      { summonerName: 'TestPlayer', team: 'ORDER', currentGold: 1000, championName: 'Zed', position: 'MID', scores: { kills: 0, deaths: 3, assists: 0 } },
      { summonerName: 'Ally2', team: 'ORDER', currentGold: 800, championName: 'Jinx', position: 'BOT', scores: { kills: 1, deaths: 2, assists: 1 } },
      { summonerName: 'Enemy1', team: 'CHAOS', currentGold: 3000, championName: 'Ahri', position: 'MID', scores: { kills: 5, deaths: 0, assists: 3 } },
      { summonerName: 'Enemy2', team: 'CHAOS', currentGold: 2500, championName: 'Caitlyn', position: 'BOT', scores: { kills: 4, deaths: 0, assists: 2 } }
    ]
    const diff = computeTeamGoldDiff(enemyAheadPlayers, 'TestPlayer')
    // ORDER: 1000+800=1800, CHAOS: 3000+2500=5500 → diff = -3700
    expect(diff).toBe(-3700)
  })
})

describe('detectMeaningfulChange', () => {
  it('returns true when prev is null (first game detection)', () => {
    expect(detectMeaningfulChange(null, baseGameState)).toBe(true)
  })

  it('returns true when death count increases', () => {
    const next = { ...baseGameState, deaths: 2 }
    expect(detectMeaningfulChange(baseGameState, next)).toBe(true)
  })

  it('returns true when kill count increases', () => {
    const next = { ...baseGameState, kills: 6 }
    expect(detectMeaningfulChange(baseGameState, next)).toBe(true)
  })

  it('returns true on new DragonKill event', () => {
    const next = { ...baseGameState, recentEvents: ['DragonKill', 'TurretKilled', 'BaronKill'] }
    expect(detectMeaningfulChange(baseGameState, next)).toBe(true)
  })

  it('returns true when game phase changes', () => {
    // early (10:00) → mid (16:00)
    const next = { ...baseGameState, gameTime: '16:00' }
    expect(detectMeaningfulChange(baseGameState, next)).toBe(true)
  })

  it('returns true when gold diff shifts >500', () => {
    const next = { ...baseGameState, teamGoldDiff: 2300 } // shift of 600
    expect(detectMeaningfulChange(baseGameState, next)).toBe(true)
  })

  it('returns false on minor gold fluctuation', () => {
    const next = { ...baseGameState, teamGoldDiff: 1900 } // shift of 200
    expect(detectMeaningfulChange(baseGameState, next)).toBe(false)
  })

  it('returns false when no meaningful changes', () => {
    const next = { ...baseGameState }
    expect(detectMeaningfulChange(baseGameState, next)).toBe(false)
  })
})

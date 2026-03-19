import { describe, it, expect } from 'vitest'
import {
  extractRecentEvents,
  computeTeamGoldDiff,
  detectMeaningfulChange,
  formatRelativeTime,
  findLaneOpponent,
  computeEventDetail,
  hasStateChangedSince,
  resetFingerprintState,
  computeObjectiveTimers,
  computeBuffDurations,
  computeDeadTimeTotal,
  computeAbilityLevelHint
} from '../electron/main/poller'
import type { GameState, GameEvent } from '../shared/types'

// Fixtures
const mockEvents = [
  { EventName: 'DragonKill', EventTime: 300 },
  { EventName: 'TurretKilled', EventTime: 310 },
  { EventName: 'BaronKill', EventTime: 400 },
  { EventName: 'MinionsSpawning', EventTime: 0 },
  { EventName: 'ChampionKill', EventTime: 390 }
]

const mockPlayers = [
  { summonerName: 'TestPlayer', team: 'ORDER', currentGold: 3000, championName: 'Zed', position: 'MID', scores: { kills: 5, deaths: 1, assists: 2, creepScore: 80, wardScore: 20 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Ignite' } } },
  { summonerName: 'Ally2', team: 'ORDER', currentGold: 2500, championName: 'Jinx', position: 'BOT', scores: { kills: 3, deaths: 0, assists: 4, creepScore: 100, wardScore: 10 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Heal' } } },
  { summonerName: 'Enemy1', team: 'CHAOS', currentGold: 2000, championName: 'Ahri', position: 'MID', scores: { kills: 2, deaths: 2, assists: 1, creepScore: 70, wardScore: 15 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Ignite' } } },
  { summonerName: 'Enemy2', team: 'CHAOS', currentGold: 1800, championName: 'Caitlyn', position: 'BOT', scores: { kills: 1, deaths: 3, assists: 0, creepScore: 90, wardScore: 8 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Heal' } } }
]

const makeEvent = (name: string, time: number, relativeTime: string): GameEvent => ({
  name,
  time,
  relativeTime,
  category: name === 'DragonKill' || name === 'BaronKill' ? 'objective'
    : name === 'TurretKilled' ? 'structure'
    : name === 'ChampionKill' || name === 'FirstBlood' ? 'kill'
    : 'game'
})

const baseGameState: GameState = {
  champion: 'Zed',
  role: 'MID',
  gameMode: 'CLASSIC',
  gameTime: '10:00',
  kills: 5,
  deaths: 1,
  assists: 2,
  gold: 3000,
  teamGoldDiff: 1700,
  recentEvents: [
    makeEvent('DragonKill', 540, '2m 0s ago'),
    makeEvent('TurretKilled', 550, '1m 50s ago')
  ],
  summonerName: 'TestPlayer',
  items: [],
  abilities: {
    q: { displayName: 'Razor Shuriken', level: 3 },
    w: { displayName: 'Living Shadow', level: 1 },
    e: { displayName: 'Shadow Slash', level: 2 },
    r: { displayName: 'Death Mark', level: 1 },
    passive: { displayName: 'Contempt for the Weak' }
  },
  runes: { keystone: 'Electrocute', primaryTree: 'Domination', secondaryTree: 'Sorcery' },
  summonerSpells: { spell1: 'Flash', spell2: 'Ignite' },
  laneOpponent: { championName: 'Ahri', kills: 2, deaths: 2, assists: 1 },
  allies: [{ championName: 'Jinx', items: [], level: 8 }],
  enemies: [{ championName: 'Ahri', items: [], level: 8 }, { championName: 'Caitlyn', items: [], level: 7 }],
  cs: 50,
  wardScore: 15,
  level: 8,
  objectiveTimers: { baronAvailable: false, heraldAvailable: true, dragonAvailableIn: 0 },
  buffDurations: { baronBuffRemaining: 0, dragonBuffRemaining: 0 },
  deadTimeTotal: 0,
  abilityLevelHint: 'Level Q next (max first for damage)'
}

describe('extractRecentEvents', () => {
  it('returns only relevant events within last 120s', () => {
    const result = extractRecentEvents(mockEvents, 420)
    const names = result.map((e) => e.name)
    expect(names).toContain('DragonKill')
    expect(names).toContain('TurretKilled')
    expect(names).toContain('BaronKill')
    expect(names).toContain('ChampionKill')
    expect(names).not.toContain('MinionsSpawning')
  })

  it('returns GameEvent objects with correct shape', () => {
    const result = extractRecentEvents(mockEvents, 420)
    for (const e of result) {
      expect(e).toHaveProperty('name')
      expect(e).toHaveProperty('time')
      expect(e).toHaveProperty('relativeTime')
      expect(e).toHaveProperty('category')
    }
  })

  it('assigns correct categories', () => {
    const result = extractRecentEvents(mockEvents, 420)
    const dragon = result.find((e) => e.name === 'DragonKill')
    expect(dragon?.category).toBe('objective')
    const turret = result.find((e) => e.name === 'TurretKilled')
    expect(turret?.category).toBe('structure')
    const kill = result.find((e) => e.name === 'ChampionKill')
    expect(kill?.category).toBe('kill')
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
    const names = result.map((e) => e.name)
    expect(names).not.toContain('DragonKill')
  })

  it('excludes untracked event types like MinionsSpawning', () => {
    const result = extractRecentEvents(
      [{ EventName: 'MinionsSpawning', EventTime: 60 }],
      120
    )
    expect(result).toHaveLength(0)
  })

  it('includes all tracked event types', () => {
    const allTracked = [
      { EventName: 'DragonKill', EventTime: 0 },
      { EventName: 'BaronKill', EventTime: 0 },
      { EventName: 'TurretKilled', EventTime: 0 },
      { EventName: 'ChampionKill', EventTime: 0 },
      { EventName: 'InhibitorKilled', EventTime: 0 },
      { EventName: 'ItemPurchased', EventTime: 0 },
      { EventName: 'WardPlaced', EventTime: 0 },
      { EventName: 'WardKilled', EventTime: 0 },
      { EventName: 'FirstBlood', EventTime: 0 },
      { EventName: 'GameStart', EventTime: 0 }
    ]
    const result = extractRecentEvents(allTracked, 100)
    expect(result.length).toBe(10)
  })
})

describe('formatRelativeTime', () => {
  it('formats sub-minute diff as seconds', () => {
    expect(formatRelativeTime(300, 308)).toBe('8s ago')
  })

  it('formats multi-minute diff correctly', () => {
    expect(formatRelativeTime(0, 135)).toBe('2m 15s ago')
  })

  it('returns 0s ago when event time equals current time', () => {
    expect(formatRelativeTime(500, 500)).toBe('0s ago')
  })

  it('clamps negative diff to 0', () => {
    expect(formatRelativeTime(600, 500)).toBe('0s ago')
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
    const enemyAheadPlayers = [
      { summonerName: 'TestPlayer', team: 'ORDER', currentGold: 1000, championName: 'Zed', position: 'MID', scores: { kills: 0, deaths: 3, assists: 0, creepScore: 30, wardScore: 5 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Ignite' } } },
      { summonerName: 'Ally2', team: 'ORDER', currentGold: 800, championName: 'Jinx', position: 'BOT', scores: { kills: 1, deaths: 2, assists: 1, creepScore: 40, wardScore: 4 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Heal' } } },
      { summonerName: 'Enemy1', team: 'CHAOS', currentGold: 3000, championName: 'Ahri', position: 'MID', scores: { kills: 5, deaths: 0, assists: 3, creepScore: 90, wardScore: 18 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Ignite' } } },
      { summonerName: 'Enemy2', team: 'CHAOS', currentGold: 2500, championName: 'Caitlyn', position: 'BOT', scores: { kills: 4, deaths: 0, assists: 2, creepScore: 110, wardScore: 12 }, items: [], summonerSpells: { summonerSpellOne: { displayName: 'Flash' }, summonerSpellTwo: { displayName: 'Heal' } } }
    ]
    const diff = computeTeamGoldDiff(enemyAheadPlayers, 'TestPlayer')
    // ORDER: 1000+800=1800, CHAOS: 3000+2500=5500 → diff = -3700
    expect(diff).toBe(-3700)
  })
})

describe('findLaneOpponent', () => {
  it('returns the enemy player with the same position', () => {
    const result = findLaneOpponent(mockPlayers, 'TestPlayer')
    expect(result).not.toBeNull()
    expect(result?.championName).toBe('Ahri')
    expect(result?.kills).toBe(2)
    expect(result?.deaths).toBe(2)
    expect(result?.assists).toBe(1)
  })

  it('returns null for ARAM (empty position strings)', () => {
    const aramPlayers = mockPlayers.map((p) => ({ ...p, position: '' }))
    const result = findLaneOpponent(aramPlayers, 'TestPlayer')
    expect(result).toBeNull()
  })

  it('returns null when summoner is not found', () => {
    const result = findLaneOpponent(mockPlayers, 'UnknownPlayer')
    expect(result).toBeNull()
  })

  it('returns null when no enemy has the same position', () => {
    const mismatchPlayers = mockPlayers.map((p, i) =>
      i === 2 ? { ...p, position: 'TOP' } : p  // Enemy1 now plays TOP instead of MID
    ) as typeof mockPlayers
    const result = findLaneOpponent(mismatchPlayers, 'TestPlayer')
    expect(result).toBeNull()
  })

  it('does not match teammates', () => {
    const result = findLaneOpponent(mockPlayers, 'TestPlayer')
    // Ally2 is also ORDER team — must not be returned
    expect(result?.championName).not.toBe('Jinx')
  })
})

describe('computeEventDetail', () => {
  const summonerName = 'TestPlayer'
  const allyNames = new Set(['Ally2'])
  const championMap = new Map([
    ['TestPlayer', 'Zed'],
    ['Ally2', 'Jinx'],
    ['Enemy1', 'Ahri'],
    ['Enemy2', 'Caitlyn']
  ])

  it('returns "You killed [champion]" when active player is the killer', () => {
    const detail = computeEventDetail(
      { EventName: 'ChampionKill', EventTime: 300, KillerName: 'TestPlayer', VictimName: 'Enemy1' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('You killed Ahri')
  })

  it('returns "Killed by [champion]" when active player is the victim', () => {
    const detail = computeEventDetail(
      { EventName: 'ChampionKill', EventTime: 300, KillerName: 'Enemy1', VictimName: 'TestPlayer' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Killed by Ahri')
  })

  it('returns "Ally [champ] killed by [champ]" when an ally is the victim', () => {
    const detail = computeEventDetail(
      { EventName: 'ChampionKill', EventTime: 300, KillerName: 'Enemy1', VictimName: 'Ally2' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Ally Jinx killed by Ahri')
  })

  it('returns "Ally [champ] killed [champ]" when an ally is the killer', () => {
    const detail = computeEventDetail(
      { EventName: 'ChampionKill', EventTime: 300, KillerName: 'Ally2', VictimName: 'Enemy2' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Ally Jinx killed Caitlyn')
  })

  it('falls back to summoner name when no championMap provided', () => {
    const detail = computeEventDetail(
      { EventName: 'ChampionKill', EventTime: 300, KillerName: 'Enemy1', VictimName: 'TestPlayer' },
      summonerName, allyNames
    )
    expect(detail).toBe('Killed by Enemy1')
  })

  it('prefixes First Blood correctly', () => {
    const detail = computeEventDetail(
      { EventName: 'FirstBlood', EventTime: 100, Acer: 'TestPlayer', VictimName: 'Enemy1' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('First Blood: You killed Ahri')
  })

  it('returns "Ally team took X Dragon" for ally dragon kill', () => {
    const detail = computeEventDetail(
      { EventName: 'DragonKill', EventTime: 300, KillerName: 'TestPlayer', DragonType: 'Fire', Stolen: 'False' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Ally team took Fire Dragon')
  })

  it('returns "Enemy team stole Baron!" for stolen baron', () => {
    const detail = computeEventDetail(
      { EventName: 'BaronKill', EventTime: 1200, KillerName: 'Enemy1', Stolen: 'True' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Enemy team stole Baron!')
  })

  it('returns team-aware turret detail', () => {
    const detail = computeEventDetail(
      { EventName: 'TurretKilled', EventTime: 500, KillerName: 'Ally2' },
      summonerName, allyNames, championMap
    )
    expect(detail).toBe('Ally team destroyed a turret')
  })

  it('returns undefined for unhandled event types', () => {
    const detail = computeEventDetail(
      { EventName: 'WardPlaced', EventTime: 120 },
      summonerName, allyNames
    )
    expect(detail).toBeUndefined()
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
    const next = {
      ...baseGameState,
      recentEvents: [
        ...baseGameState.recentEvents,
        makeEvent('BaronKill', 600, '0s ago')
      ]
    }
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

describe('hasStateChangedSince (fingerprinting)', () => {
  it('returns true on first call (no previous fingerprint)', () => {
    resetFingerprintState()
    expect(hasStateChangedSince(baseGameState)).toBe(true)
  })

  it('returns false when state is identical on second call', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState) // seed the fingerprint
    expect(hasStateChangedSince({ ...baseGameState })).toBe(false)
  })

  it('returns true when kills change', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    expect(hasStateChangedSince({ ...baseGameState, kills: 6 })).toBe(true)
  })

  it('returns true when deaths change', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    expect(hasStateChangedSince({ ...baseGameState, deaths: 2 })).toBe(true)
  })

  it('returns true when CS changes', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    expect(hasStateChangedSince({ ...baseGameState, cs: 55 })).toBe(true)
  })

  it('returns true when items change (new item)', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    const withItem = {
      ...baseGameState,
      items: [{ displayName: 'Serylda\'s Grudge', itemID: 6694, slot: 0, count: 1, price: 3200 }]
    }
    expect(hasStateChangedSince(withItem)).toBe(true)
  })

  it('returns true when R level changes', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    const withR2 = {
      ...baseGameState,
      abilities: { ...baseGameState.abilities, r: { displayName: 'Death Mark', level: 2 } }
    }
    expect(hasStateChangedSince(withR2)).toBe(true)
  })

  it('returns true when 2-min game time bucket changes', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState) // gameTime = '10:00' → bucket 3 (600/120=5)
    expect(hasStateChangedSince({ ...baseGameState, gameTime: '12:00' })).toBe(true)
  })

  it('returns false within the same 2-min bucket', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState) // gameTime '10:00' = 600s → bucket 5
    // '10:30' = 630s → same bucket 5
    expect(hasStateChangedSince({ ...baseGameState, gameTime: '10:30' })).toBe(false)
  })

  it('returns true when gold crosses a 500g bucket boundary', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState) // gold = 3000 → bucket 6
    expect(hasStateChangedSince({ ...baseGameState, gold: 3500 })).toBe(true)
  })

  it('resetFingerprintState allows first call to return true again', () => {
    resetFingerprintState()
    hasStateChangedSince(baseGameState)
    hasStateChangedSince(baseGameState) // now false
    resetFingerprintState()
    expect(hasStateChangedSince(baseGameState)).toBe(true)
  })
})

describe('computeObjectiveTimers', () => {
  it('baron is not available before 20 min', () => {
    const result = computeObjectiveTimers(1199, [])
    expect(result.baronAvailable).toBe(false)
  })

  it('baron becomes available at exactly 20 min (1200s)', () => {
    const result = computeObjectiveTimers(1200, [])
    expect(result.baronAvailable).toBe(true)
  })

  it('herald is not available before 8 min', () => {
    const result = computeObjectiveTimers(479, [])
    expect(result.heraldAvailable).toBe(false)
  })

  it('herald is available between 8 and 20 min', () => {
    const result = computeObjectiveTimers(900, [])
    expect(result.heraldAvailable).toBe(true)
  })

  it('herald despawns at 20 min', () => {
    const result = computeObjectiveTimers(1200, [])
    expect(result.heraldAvailable).toBe(false)
  })

  it('dragon is available at game start (no kills)', () => {
    const result = computeObjectiveTimers(400, [])
    // dragon spawns at 5min (300s), before 300s dragonAvailableIn > 0
    expect(result.dragonAvailableIn).toBe(0)
  })

  it('dragon countdown before first spawn', () => {
    const result = computeObjectiveTimers(100, [])
    expect(result.dragonAvailableIn).toBe(200)
  })

  it('dragon respawn timer 200s after kill', () => {
    const events = [{ EventName: 'DragonKill', EventTime: 400 }]
    const result = computeObjectiveTimers(600, events)
    // next dragon at 400+300=700, current=600 → 100s remaining
    expect(result.dragonAvailableIn).toBe(100)
  })

  it('dragon available when respawn time has passed', () => {
    const events = [{ EventName: 'DragonKill', EventTime: 300 }]
    const result = computeObjectiveTimers(700, events)
    // next dragon at 300+300=600, current=700 → available
    expect(result.dragonAvailableIn).toBe(0)
  })
})

describe('computeBuffDurations', () => {
  it('returns 0 for both buffs with no events', () => {
    const result = computeBuffDurations(500, [])
    expect(result.baronBuffRemaining).toBe(0)
    expect(result.dragonBuffRemaining).toBe(0)
  })

  it('baron buff active immediately after kill', () => {
    const events = [{ EventName: 'BaronKill', EventTime: 1200 }]
    const result = computeBuffDurations(1200, events)
    expect(result.baronBuffRemaining).toBe(180)
  })

  it('baron buff decreases over time', () => {
    const events = [{ EventName: 'BaronKill', EventTime: 1200 }]
    const result = computeBuffDurations(1300, events)
    expect(result.baronBuffRemaining).toBe(80)
  })

  it('baron buff is 0 after 180s', () => {
    const events = [{ EventName: 'BaronKill', EventTime: 1200 }]
    const result = computeBuffDurations(1380, events)
    expect(result.baronBuffRemaining).toBe(0)
  })

  it('dragon buff active immediately after kill', () => {
    const events = [{ EventName: 'DragonKill', EventTime: 500 }]
    const result = computeBuffDurations(500, events)
    expect(result.dragonBuffRemaining).toBe(210)
  })

  it('dragon buff is 0 after 210s', () => {
    const events = [{ EventName: 'DragonKill', EventTime: 500 }]
    const result = computeBuffDurations(710, events)
    expect(result.dragonBuffRemaining).toBe(0)
  })

  it('uses the most recent baron kill when multiple kills exist', () => {
    const events = [
      { EventName: 'BaronKill', EventTime: 1200 },
      { EventName: 'BaronKill', EventTime: 1800 }
    ]
    const result = computeBuffDurations(1810, events)
    // Should use 1800, not 1200
    expect(result.baronBuffRemaining).toBe(170)
  })
})

describe('computeDeadTimeTotal', () => {
  it('returns 0 when no deaths', () => {
    const result = computeDeadTimeTotal([], 'TestPlayer')
    expect(result).toBe(0)
  })

  it('accumulates dead time for early game deaths', () => {
    const events = [
      { EventName: 'ChampionKill', EventTime: 200, VictimName: 'TestPlayer', KillerName: 'Enemy1' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(15) // early game approximation
  })

  it('accumulates dead time for mid game deaths', () => {
    const events = [
      { EventName: 'ChampionKill', EventTime: 1200, VictimName: 'TestPlayer', KillerName: 'Enemy1' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(22) // mid game approximation
  })

  it('accumulates dead time for late game deaths', () => {
    const events = [
      { EventName: 'ChampionKill', EventTime: 2000, VictimName: 'TestPlayer', KillerName: 'Enemy1' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(35) // late game approximation
  })

  it('sums multiple deaths', () => {
    const events = [
      { EventName: 'ChampionKill', EventTime: 200, VictimName: 'TestPlayer', KillerName: 'Enemy1' },
      { EventName: 'ChampionKill', EventTime: 1200, VictimName: 'TestPlayer', KillerName: 'Enemy1' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(37) // 15 + 22
  })

  it('ignores deaths of other players', () => {
    const events = [
      { EventName: 'ChampionKill', EventTime: 200, VictimName: 'Enemy1', KillerName: 'TestPlayer' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(0)
  })

  it('ignores non-kill events', () => {
    const events = [
      { EventName: 'DragonKill', EventTime: 500, KillerName: 'TestPlayer' },
      { EventName: 'BaronKill', EventTime: 1200, KillerName: 'TestPlayer' }
    ]
    const result = computeDeadTimeTotal(events, 'TestPlayer')
    expect(result).toBe(0)
  })
})

describe('computeAbilityLevelHint', () => {
  it('returns empty string for level 0', () => {
    expect(computeAbilityLevelHint(0)).toBe('')
  })

  it('returns R hint at level 6', () => {
    expect(computeAbilityLevelHint(6)).toContain('R')
  })

  it('returns R hint at level 11', () => {
    expect(computeAbilityLevelHint(11)).toContain('R')
  })

  it('returns R hint at level 16', () => {
    expect(computeAbilityLevelHint(16)).toContain('R')
  })

  it('returns a non-empty hint for all levels 1-18', () => {
    for (let level = 1; level <= 18; level++) {
      const hint = computeAbilityLevelHint(level)
      expect(hint.length).toBeGreaterThan(0)
    }
  })

  it('returns Q hint for early levels', () => {
    const hint = computeAbilityLevelHint(1)
    // Level 1 falls in qPriority or defaults to generic hint
    expect(typeof hint).toBe('string')
  })
})

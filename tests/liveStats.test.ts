import { describe, it, expect } from 'vitest'
import { computeLiveStats } from '../electron/main/liveStats'
import type { GameState, GameEvent } from '../shared/types'

const makeEvent = (
  name: string,
  time: number,
  category: GameEvent['category'],
  detail?: string
): GameEvent => ({ name, time, relativeTime: '0s ago', category, detail })

const baseState: GameState = {
  champion: 'Zed',
  role: 'MID',
  gameMode: 'CLASSIC',
  gameTime: '10:00',
  kills: 5,
  deaths: 2,
  assists: 3,
  gold: 800,
  teamGoldDiff: 1200,
  recentEvents: [],
  summonerName: 'TestPlayer',
  items: [
    { displayName: 'Long Sword', itemID: 1036, slot: 0, count: 1, price: 350 },
    { displayName: "Serpent's Fang", itemID: 3814, slot: 1, count: 1, price: 2600 }
  ],
  abilities: {
    q: { displayName: 'Q', level: 3 },
    w: { displayName: 'W', level: 1 },
    e: { displayName: 'E', level: 2 },
    r: { displayName: 'R', level: 1 },
    passive: { displayName: 'Passive' }
  },
  runes: { keystone: 'Electrocute', primaryTree: 'Domination', secondaryTree: 'Sorcery' },
  summonerSpells: { spell1: 'Flash', spell2: 'Ignite' },
  laneOpponent: { championName: 'Ahri', kills: 1, deaths: 2, assists: 1 },
  allies: [{ championName: 'Jinx', items: [], level: 8 }],
  enemies: [{ championName: 'Ahri', items: [], level: 9 }],
  cs: 72,
  wardScore: 15,
  level: 8,
  objectiveTimers: { baronAvailable: false, heraldAvailable: true, dragonAvailableIn: 0 },
  buffDurations: { baronBuffRemaining: 0, dragonBuffRemaining: 0 },
  deadTimeTotal: 0,
  abilityLevelHint: 'Level Q next (max first for damage)'
}

const killEvents: GameEvent[] = [
  makeEvent('ChampionKill', 120, 'kill', 'You killed Ahri'),
  makeEvent('ChampionKill', 200, 'kill', 'You killed Ahri'),
  makeEvent('ChampionKill', 300, 'kill', 'Ally Jinx killed Caitlyn'),
  makeEvent('ChampionKill', 350, 'kill', 'Killed by Ahri'),
  makeEvent('ChampionKill', 400, 'kill', 'You killed Caitlyn'),
  makeEvent('ChampionKill', 450, 'kill', 'Ally Jinx killed Zed'),
  makeEvent('ChampionKill', 500, 'kill', 'You killed Ahri'),
]

describe('computeLiveStats — KDA', () => {
  it('computes KDA ratio correctly', () => {
    const stats = computeLiveStats(baseState, [])
    // (5+3)/max(1,2) = 4.0
    expect(stats.kdaRatio).toBe(4.0)
  })

  it('handles 0 deaths gracefully (divides by 1)', () => {
    const noDeaths = { ...baseState, deaths: 0 }
    const stats = computeLiveStats(noDeaths, [])
    expect(stats.kdaRatio).toBe(parseFloat(((5 + 3) / 1).toFixed(1)))
  })
})

describe('computeLiveStats — CS/min', () => {
  it('computes CS/min at 10:00 (10 min)', () => {
    const stats = computeLiveStats(baseState, [])
    // 72 cs / 10 min = 7.2
    expect(stats.csPerMin).toBe(7.2)
  })

  it('handles 0 game time without dividing by zero', () => {
    const noTime = { ...baseState, gameTime: '0:00', cs: 0 }
    const stats = computeLiveStats(noTime, [])
    expect(isFinite(stats.csPerMin)).toBe(true)
  })

  it('handles ARAM (gameTime as seconds float)', () => {
    const aramState = { ...baseState, gameTime: '600', cs: 60 }
    const stats = computeLiveStats(aramState, [])
    expect(stats.csPerMin).toBeCloseTo(6.0, 1)
  })
})

describe('computeLiveStats — gold stats', () => {
  it('computes gold per minute from current + items', () => {
    const stats = computeLiveStats(baseState, [])
    // items: 350 + 2600 = 2950; total = 800 + 2950 = 3750; /10 min = 375
    expect(stats.goldPerMin).toBe(375)
  })

  it('goldUnspent equals current gold', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.goldUnspent).toBe(800)
  })

  it('totalGoldInItems sums item prices', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.totalGoldInItems).toBe(2950)
  })

  it('goldEfficiency = items / total * 100', () => {
    const stats = computeLiveStats(baseState, [])
    // 2950 / 3750 * 100 ≈ 79
    expect(stats.goldEfficiency).toBe(Math.round(2950 / 3750 * 100))
  })

  it('goldEfficiency is 0 when no gold at all', () => {
    const broke = { ...baseState, gold: 0, items: [] }
    const stats = computeLiveStats(broke, [])
    expect(stats.goldEfficiency).toBe(0)
  })
})

describe('computeLiveStats — deaths per 10 min', () => {
  it('computes deaths per 10 min at 10:00', () => {
    const stats = computeLiveStats(baseState, [])
    // 2 deaths / 10 min * 10 = 2.0
    expect(stats.deathsPer10Min).toBe(2.0)
  })
})

describe('computeLiveStats — kill participation', () => {
  it('computes KP from kill events', () => {
    const stats = computeLiveStats(baseState, killEvents)
    // Team kills: "You killed" (3) + "Ally Jinx killed Caitlyn" (1) + "Ally Jinx killed Zed" (1) = 5
    // Player: kills(5) + assists(3) = 8, KP = min(100, round(8/5*100)) = 100
    // Actually our player has 5 kills but only 3 are in events + we only count by event
    // Team kills from events: 3 (You killed) + 2 (Ally killed) = 5
    // KP = (5+3)/5 * 100 = 160 → capped at 100
    expect(stats.killParticipation).toBe(100)
  })

  it('returns 0 KP when no kill events', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.killParticipation).toBe(0)
  })

  it('killShare = player kills / team kills', () => {
    const state = { ...baseState, kills: 3, assists: 1 }
    // Team kills from killEvents: "You killed" (3) + "Ally Jinx killed Caitlyn" + "Ally Jinx killed Zed" = 6
    const stats = computeLiveStats(state, killEvents)
    // 3/6*100 = 50%
    expect(stats.killShare).toBe(50)
  })

  it('assistShare = player assists / team kills', () => {
    // Team kills = 6 from killEvents (3 You + 2 Ally)
    const stats = computeLiveStats(baseState, killEvents)
    // assists = 3, team kills = 6 → 50%
    expect(stats.assistShare).toBe(50)
  })
})

describe('computeLiveStats — gold diff trend', () => {
  it('returns "gaining" when teamGoldDiff > 500', () => {
    const stats = computeLiveStats(baseState, []) // baseState.teamGoldDiff = 1200
    expect(stats.goldDiffTrend).toBe('gaining')
  })

  it('returns "losing" when teamGoldDiff < -500', () => {
    const losing = { ...baseState, teamGoldDiff: -800 }
    const stats = computeLiveStats(losing, [])
    expect(stats.goldDiffTrend).toBe('losing')
  })

  it('returns "stable" when |teamGoldDiff| <= 500', () => {
    const stable = { ...baseState, teamGoldDiff: 200 }
    const stats = computeLiveStats(stable, [])
    expect(stats.goldDiffTrend).toBe('stable')
  })
})

describe('computeLiveStats — vision', () => {
  const visionEvents: GameEvent[] = [
    makeEvent('WardPlaced', 100, 'vision'),
    makeEvent('WardPlaced', 200, 'vision'),
    makeEvent('WardPlaced', 300, 'vision'),
    makeEvent('WardKilled', 150, 'vision'),
    makeEvent('WardKilled', 250, 'vision')
  ]

  it('counts wards placed from events', () => {
    const stats = computeLiveStats(baseState, visionEvents)
    expect(stats.wardsPlaced).toBe(3)
  })

  it('counts wards killed from events', () => {
    const stats = computeLiveStats(baseState, visionEvents)
    expect(stats.wardsKilled).toBe(2)
  })

  it('wardScore comes from game state', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.wardScore).toBe(15) // baseState.wardScore = 15
  })
})

describe('computeLiveStats — objectives', () => {
  const objectiveEvents: GameEvent[] = [
    makeEvent('DragonKill', 300, 'objective', 'Ally team took Fire Dragon'),
    makeEvent('DragonKill', 600, 'objective', 'Enemy team took Mountain Dragon'),
    makeEvent('DragonKill', 900, 'objective', 'Ally team took Ocean Dragon'),
    makeEvent('TurretKilled', 400, 'structure', 'Ally team destroyed a turret'),
    makeEvent('TurretKilled', 500, 'structure', 'Enemy team destroyed a turret'),
    makeEvent('InhibitorKilled', 800, 'objective', 'Ally team destroyed an inhibitor')
  ]

  it('dragonControl = ally dragons / total * 100', () => {
    const stats = computeLiveStats(baseState, objectiveEvents)
    // 2 ally, 1 enemy → 2/3 * 100 = 67
    expect(stats.dragonControl).toBe(67)
  })

  it('turretsDestroyed counts ally turret events', () => {
    const stats = computeLiveStats(baseState, objectiveEvents)
    expect(stats.turretsDestroyed).toBe(1)
  })

  it('inhibitorsDestroyed counts ally inhib events', () => {
    const stats = computeLiveStats(baseState, objectiveEvents)
    expect(stats.inhibitorsDestroyed).toBe(1)
  })

  it('dragonControl is 0 when no dragons', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.dragonControl).toBe(0)
  })
})

describe('computeLiveStats — time alive', () => {
  it('timeAlivePercent is between 0 and 100', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.timeAlivePercent).toBeGreaterThanOrEqual(0)
    expect(stats.timeAlivePercent).toBeLessThanOrEqual(100)
  })

  it('player with 0 deaths has high time alive percent', () => {
    const noDeaths = { ...baseState, deaths: 0 }
    const stats = computeLiveStats(noDeaths, [])
    expect(stats.timeAlivePercent).toBe(100)
  })
})

describe('computeLiveStats — kill streak', () => {
  it('returns "on fire" for 3+ consecutive kills', () => {
    const streak = [
      makeEvent('ChampionKill', 100, 'kill', 'You killed Ahri'),
      makeEvent('ChampionKill', 200, 'kill', 'You killed Caitlyn'),
      makeEvent('ChampionKill', 300, 'kill', 'You killed Yasuo')
    ]
    const stats = computeLiveStats(baseState, streak)
    expect(stats.currentStreak).toBe('on fire')
  })

  it('returns "killing" for 1-2 kills without death', () => {
    const streak = [makeEvent('ChampionKill', 100, 'kill', 'You killed Ahri')]
    const stats = computeLiveStats(baseState, streak)
    expect(stats.currentStreak).toBe('killing')
  })

  it('returns "none" after a death resets streak', () => {
    const deathLast = [
      makeEvent('ChampionKill', 100, 'kill', 'You killed Ahri'),
      makeEvent('ChampionKill', 200, 'kill', 'You killed Caitlyn'),
      makeEvent('ChampionKill', 300, 'kill', 'Killed by Yasuo')
    ]
    const stats = computeLiveStats(baseState, deathLast)
    expect(stats.currentStreak).toBe('none')
  })

  it('returns "none" when no events', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.currentStreak).toBe('none')
  })
})

describe('computeLiveStats — game phase', () => {
  it('returns "early" before 15 min', () => {
    const stats = computeLiveStats(baseState, []) // baseState.gameTime = '10:00'
    expect(stats.gamePhase).toBe('early')
  })

  it('returns "mid" between 15-30 min', () => {
    const mid = { ...baseState, gameTime: '20:00' }
    const stats = computeLiveStats(mid, [])
    expect(stats.gamePhase).toBe('mid')
  })

  it('returns "late" at 30+ min', () => {
    const late = { ...baseState, gameTime: '32:00' }
    const stats = computeLiveStats(late, [])
    expect(stats.gamePhase).toBe('late')
  })
})

describe('computeLiveStats — item and ability slots', () => {
  it('itemSlotsUsed counts current items', () => {
    const stats = computeLiveStats(baseState, [])
    expect(stats.itemSlotsUsed).toBe(2) // baseState has 2 items
  })

  it('abilityPointsUsed sums Q+W+E+R levels', () => {
    const stats = computeLiveStats(baseState, [])
    // Q(3)+W(1)+E(2)+R(1) = 7
    expect(stats.abilityPointsUsed).toBe(7)
  })
})

describe('computeLiveStats — edge cases', () => {
  it('handles all zeros gracefully', () => {
    const zeros: GameState = {
      ...baseState,
      kills: 0,
      deaths: 0,
      assists: 0,
      gold: 0,
      teamGoldDiff: 0,
      gameTime: '0:00',
      cs: 0,
      wardScore: 0,
      level: 1,
      items: []
    }
    expect(() => computeLiveStats(zeros, [])).not.toThrow()
    const stats = computeLiveStats(zeros, [])
    expect(stats.kdaRatio).toBe(0)
    expect(stats.csPerMin).toBe(0)
    expect(stats.killParticipation).toBe(0)
  })

  it('returns all required LiveStats fields', () => {
    const stats = computeLiveStats(baseState, [])
    const requiredFields: (keyof typeof stats)[] = [
      'csPerMin', 'goldPerMin', 'kdaRatio', 'deathsPer10Min',
      'killParticipation', 'killShare', 'assistShare', 'goldDiffTrend',
      'goldUnspent', 'totalGoldInItems', 'goldEfficiency',
      'wardsPlaced', 'wardsKilled', 'wardScore', 'dragonControl',
      'turretsDestroyed', 'inhibitorsDestroyed', 'timeAlivePercent',
      'currentStreak', 'gamePhase', 'itemSlotsUsed', 'abilityPointsUsed'
    ]
    for (const field of requiredFields) {
      expect(stats[field]).toBeDefined()
    }
  })
})

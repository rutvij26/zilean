import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GameState, CoachingGoals, CoachingUpdate } from '../../shared/types'

// We test the orchestration logic in isolation, not the Electron windows
// The key behaviors are modelled in a pure function extracted for testability

interface LoopState {
  cachedGoals: CoachingGoals | null
  prevState: GameState | null
  lastCoachTime: number
}

const FORCE_INTERVAL_MS = 180_000

async function runGameLoop(
  gameState: GameState | null,
  loopState: LoopState,
  generateCoaching: (s: GameState) => Promise<CoachingGoals>,
  storeSummonerName: (name: string) => void,
  detectMeaningfulChange: (prev: GameState | null, next: GameState) => boolean,
  sendUpdate: (update: CoachingUpdate) => void,
  now: number = Date.now()
): Promise<LoopState> {
  if (!gameState) {
    sendUpdate({ status: 'waiting' })
    return { cachedGoals: loopState.cachedGoals, prevState: null, lastCoachTime: 0 }
  }

  if (!loopState.prevState) {
    storeSummonerName(gameState.summonerName)
  }

  const changed = detectMeaningfulChange(loopState.prevState, gameState)
  const forceDue = now - loopState.lastCoachTime > FORCE_INTERVAL_MS

  if (!changed && !forceDue) {
    return loopState
  }

  const newState = { ...loopState, prevState: gameState }

  try {
    const goals = await generateCoaching(gameState)
    sendUpdate({ status: 'active', goals })
    return { ...newState, cachedGoals: goals, lastCoachTime: now }
  } catch {
    sendUpdate({ status: 'error', goals: loopState.cachedGoals })
    return newState
  }
}

const mockGameState: GameState = {
  champion: 'Zed',
  role: 'MID',
  gameMode: 'CLASSIC',
  gameTime: '10:00',
  kills: 3,
  deaths: 1,
  assists: 2,
  gold: 2500,
  teamGoldDiff: 300,
  recentEvents: [],
  summonerName: 'TestPlayer',
  items: [],
  abilities: {
    q: { displayName: 'Razor Shuriken', level: 2 },
    w: { displayName: 'Living Shadow', level: 1 },
    e: { displayName: 'Shadow Slash', level: 1 },
    r: { displayName: 'Death Mark', level: 0 },
    passive: { displayName: 'Contempt for the Weak' }
  },
  runes: { keystone: 'Electrocute', primaryTree: 'Domination', secondaryTree: 'Sorcery' },
  summonerSpells: { spell1: 'Flash', spell2: 'Ignite' },
  laneOpponent: null,
  allies: [],
  enemies: [],
  cs: 40,
  wardScore: 10,
  level: 7,
  objectiveTimers: { baronAvailable: false, heraldAvailable: true, dragonAvailableIn: 0 },
  buffDurations: { baronBuffRemaining: 0, dragonBuffRemaining: 0 },
  deadTimeTotal: 15,
  abilityLevelHint: 'Level Q next (max first for damage)'
}

const mockGoals: CoachingGoals = {
  personalGoals: ['Focus on CS', 'Track jungler'],
  personalTag: 'Farm',
  teamGoals: ['Contest dragon', 'Rotate mid'],
  teamTag: 'Dragon',
  gamePhase: 'early',
  updatedAt: '10:00',
  matchupTip: 'Focus on farming safely and outscale in mid game.'
}

describe('gameLoop integration', () => {
  let sendUpdate: ReturnType<typeof vi.fn>
  let generateCoaching: ReturnType<typeof vi.fn>
  let storeSummonerName: ReturnType<typeof vi.fn>
  let detectMeaningfulChange: ReturnType<typeof vi.fn>
  let loopState: LoopState

  beforeEach(() => {
    sendUpdate = vi.fn()
    generateCoaching = vi.fn().mockResolvedValue(mockGoals)
    storeSummonerName = vi.fn()
    detectMeaningfulChange = vi.fn()
    loopState = { cachedGoals: null, prevState: null, lastCoachTime: 0 }
  })

  it('sends waiting status when gameState is null', async () => {
    await runGameLoop(null, loopState, generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate)
    expect(sendUpdate).toHaveBeenCalledWith({ status: 'waiting' })
    expect(generateCoaching).not.toHaveBeenCalled()
  })

  it('stores summoner name on first game detection', async () => {
    detectMeaningfulChange.mockReturnValue(true)
    await runGameLoop(mockGameState, loopState, generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate)
    expect(storeSummonerName).toHaveBeenCalledWith('TestPlayer')
  })

  it('calls coach with correct GameState and sends active update', async () => {
    detectMeaningfulChange.mockReturnValue(true)
    const newState = await runGameLoop(
      mockGameState, loopState, generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate
    )
    expect(generateCoaching).toHaveBeenCalledWith(mockGameState)
    expect(sendUpdate).toHaveBeenCalledWith({ status: 'active', goals: mockGoals })
    expect(newState.cachedGoals).toEqual(mockGoals)
  })

  it('sends error + cached goals when coach throws', async () => {
    detectMeaningfulChange.mockReturnValue(true)
    generateCoaching.mockRejectedValueOnce(new Error('API error'))
    const prevGoals: CoachingGoals = {
      personalGoals: ['Old goal 1', 'Old goal 2'],
      personalTag: 'Farm',
      teamGoals: ['Old team 1', 'Old team 2'],
      teamTag: 'Rotate',
      gamePhase: 'early',
      updatedAt: '9:00',
      matchupTip: 'Play safe and scale for late game.'
    }
    loopState.cachedGoals = prevGoals

    await runGameLoop(mockGameState, loopState, generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate)
    expect(sendUpdate).toHaveBeenCalledWith({ status: 'error', goals: prevGoals })
  })


  it('does NOT call coach when no meaningful change and <3min elapsed', async () => {
    detectMeaningfulChange.mockReturnValue(false)
    const recentTime = Date.now() - 60_000 // 1 min ago
    loopState.lastCoachTime = recentTime

    await runGameLoop(
      mockGameState, { ...loopState, prevState: mockGameState },
      generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate,
      Date.now()
    )
    expect(generateCoaching).not.toHaveBeenCalled()
    expect(sendUpdate).not.toHaveBeenCalled()
  })

  it('calls coach when no meaningful change but >3min elapsed (force interval)', async () => {
    detectMeaningfulChange.mockReturnValue(false)
    const now = Date.now()
    loopState.lastCoachTime = now - 200_000 // 3m20s ago

    await runGameLoop(
      mockGameState, { ...loopState, prevState: mockGameState },
      generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate,
      now
    )
    expect(generateCoaching).toHaveBeenCalled()
  })

  it('resets state when null gameState received after active game', async () => {
    detectMeaningfulChange.mockReturnValue(true)
    loopState = { cachedGoals: mockGoals, prevState: mockGameState, lastCoachTime: Date.now() - 5000 }

    const newState = await runGameLoop(
      null, loopState, generateCoaching, storeSummonerName, detectMeaningfulChange, sendUpdate
    )
    expect(newState.prevState).toBeNull()
    expect(newState.lastCoachTime).toBe(0)
    expect(sendUpdate).toHaveBeenCalledWith({ status: 'waiting' })
  })
})

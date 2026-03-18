import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  gameTime: '10:00',
  kills: 3,
  deaths: 1,
  assists: 2,
  gold: 2500,
  teamGoldDiff: 300,
  recentEvents: [],
  summonerName: 'TestPlayer'
}

const mockGoals: CoachingGoals = {
  personalGoals: ['Focus on CS', 'Track jungler'],
  teamGoals: ['Contest dragon', 'Rotate mid'],
  gamePhase: 'early',
  updatedAt: '10:00'
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
      teamGoals: ['Old team 1', 'Old team 2'],
      gamePhase: 'early',
      updatedAt: '9:00'
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

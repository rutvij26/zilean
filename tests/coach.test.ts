import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GameState } from '../shared/types'

// Mock @anthropic-ai/sdk before importing coach
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate }
    })),
    __mockCreate: mockCreate
  }
})

const mockGameState: GameState = {
  champion: 'Zed',
  role: 'MID',
  gameTime: '10:00',
  kills: 5,
  deaths: 1,
  assists: 2,
  gold: 3000,
  teamGoldDiff: 500,
  recentEvents: ['DragonKill'],
  summonerName: 'TestPlayer'
}

const validResponse = {
  personalGoals: ['Focus on last-hitting under tower', 'Track enemy jungler'],
  teamGoals: ['Contest dragon at 12 min', 'Push mid after skirmish'],
  gamePhase: 'early' as const,
  updatedAt: '10:00'
}

describe('generateCoaching', () => {
  let generateCoaching: (state: GameState, ctx?: string) => Promise<unknown>
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    // Set API key
    process.env.ANTHROPIC_API_KEY = 'test-key-123'

    // Re-import after reset
    const coachModule = await import('../electron/main/coach')
    generateCoaching = coachModule.generateCoaching

    // Get the mock
    const sdk = await import('@anthropic-ai/sdk')
    mockCreate = (sdk as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate
  })

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    vi.clearAllMocks()
  })

  it('returns CoachingGoals shape on valid response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result).toMatchObject({
      personalGoals: expect.any(Array),
      teamGoals: expect.any(Array),
      gamePhase: expect.stringMatching(/^(early|mid|late)$/),
      updatedAt: expect.any(String)
    })
  })

  it('validates personalGoals.length === 2', async () => {
    const bad = { ...validResponse, personalGoals: ['only one goal'] }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(bad) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('personalGoals')
  })

  it('validates teamGoals.length === 2', async () => {
    const bad = { ...validResponse, teamGoals: ['only one', 'two', 'three'] }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(bad) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('teamGoals')
  })

  it('throws on non-JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sure! Here are your coaching goals...' }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('non-JSON')
  })

  it('throws on missing ANTHROPIC_API_KEY', async () => {
    delete process.env.ANTHROPIC_API_KEY

    await expect(generateCoaching(mockGameState)).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('strips markdown code fences from response', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: wrapped }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result.personalGoals.length).toBe(2)
  })

  it('includes historicalContext in prompt when provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState, 'You overextended pre-6 in 6/10 recent games')

    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content
    expect(userContent).toContain('Historical patterns')
    expect(userContent).toContain('overextended')
  })
})

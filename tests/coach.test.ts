import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GameState, CoachingGoals, AppSettings } from '../shared/types'

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
  gameMode: 'CLASSIC',
  gameTime: '10:00',
  kills: 5,
  deaths: 1,
  assists: 2,
  gold: 3000,
  teamGoldDiff: 500,
  recentEvents: [{ name: 'DragonKill', time: 300, relativeTime: '30s ago', category: 'objective' }],
  summonerName: 'TestPlayer',
  items: [{ displayName: 'Long Sword', itemID: 1036, slot: 0, count: 1, price: 350 }],
  abilities: {
    q: { displayName: 'Razor Shuriken', level: 3 },
    w: { displayName: 'Living Shadow', level: 1 },
    e: { displayName: 'Shadow Slash', level: 2 },
    r: { displayName: 'Death Mark', level: 1 },
    passive: { displayName: 'Contempt for the Weak' }
  },
  runes: { keystone: 'Electrocute', primaryTree: 'Domination', secondaryTree: 'Sorcery' },
  summonerSpells: { spell1: 'Flash', spell2: 'Ignite' },
  laneOpponent: { championName: 'Ahri', kills: 2, deaths: 1, assists: 3 },
  allies: [
    { championName: 'Jinx', items: ['Kraken Slayer'], level: 9 },
    { championName: 'Thresh', items: [], level: 8 }
  ],
  enemies: [
    { championName: 'Ahri', items: ['Luden\'s Tempest'], level: 9 },
    { championName: 'Yasuo', items: ['Immortal Shieldbow'], level: 10 }
  ],
  cs: 72,
  wardScore: 15,
  level: 9,
  objectiveTimers: { baronAvailable: false, heraldAvailable: true, dragonAvailableIn: 45 },
  buffDurations: { baronBuffRemaining: 0, dragonBuffRemaining: 120 },
  deadTimeTotal: 32,
  abilityLevelHint: 'Level W next (rank 2 priority)'
}

const validResponse: CoachingGoals = {
  personalGoals: ['Focus on last-hitting under tower', 'Track enemy jungler'],
  personalTag: 'Farm',
  teamGoals: ['Contest dragon at 12 min', 'Push mid after skirmish'],
  teamTag: 'Dragon',
  gamePhase: 'early' as const,
  updatedAt: '10:00',
  matchupTip: 'Poke Ahri before she hits six to deny roam pressure.'
}

type CoachingSettingsParam = Partial<Pick<AppSettings, 'aiProvider' | 'aiModel' | 'perplexityModel' | 'perplexityApiKey'>>

describe('generateCoaching', () => {
  let generateCoaching: (state: GameState, ctx?: string, settings?: CoachingSettingsParam) => Promise<CoachingGoals>
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
    delete process.env.PERPLEXITY_API_KEY
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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
      updatedAt: expect.any(String),
      matchupTip: expect.any(String)
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

  it('accepts optional item field when valid', async () => {
    const withItem = {
      ...validResponse,
      item: { name: "Serylda's Grudge", reason: 'enemies stacking armor', goldNeeded: 400 }
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(withItem) }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result).toMatchObject({
      item: { name: "Serylda's Grudge", reason: 'enemies stacking armor', goldNeeded: 400 }
    })
  })

  it('accepts optional backTiming field when valid', async () => {
    const withBackTiming = {
      ...validResponse,
      backTiming: { suggestion: 'Back after next wave', goldTarget: 1840 }
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(withBackTiming) }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result).toMatchObject({
      backTiming: { suggestion: 'Back after next wave', goldTarget: 1840 }
    })
  })

  it('is valid when item and backTiming are absent', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result.item).toBeUndefined()
    expect(result.backTiming).toBeUndefined()
  })

  it('throws on malformed item field', async () => {
    const badItem = { ...validResponse, item: { name: 'Blade', goldNeeded: 'lots' } }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(badItem) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('item')
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

  it('requires matchupTip in response', async () => {
    const noTip = { ...validResponse }
    delete (noTip as Partial<CoachingGoals>).matchupTip
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(noTip) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('matchupTip')
  })

  it('throws when matchupTip is empty string', async () => {
    const emptyTip = { ...validResponse, matchupTip: '' }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(emptyTip) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('matchupTip')
  })

  it('throws when matchupTip exceeds 20 words', async () => {
    const longTip = { ...validResponse, matchupTip: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one' }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(longTip) }]
    })

    await expect(generateCoaching(mockGameState)).rejects.toThrow('matchupTip')
  })

  it('accepts matchupTip of exactly 16 words (previously failing)', async () => {
    const tip16 = { ...validResponse, matchupTip: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen' }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(tip16) }]
    })

    const result = await generateCoaching(mockGameState)
    expect(result.matchupTip).toBeTruthy()
  })

  it('includes items and abilities in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState)

    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content
    expect(userContent).toContain('Long Sword')
    expect(userContent).toContain('Q(3)')
    expect(userContent).toContain('Electrocute')
    expect(userContent).toContain('Flash+Ignite')
    expect(userContent).toContain('Ahri')
  })

  it('includes ally and enemy team context in compact format', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState)

    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content
    // Compact format: "Jinx(9), Thresh(8)" — champion name + level, no item lists
    expect(userContent).toContain('Jinx(9)')
    expect(userContent).toContain('Yasuo(10)')
    expect(userContent).toContain('Allies')
    expect(userContent).toContain('Enemies')
    // Items should NOT appear in compact team context
    expect(userContent).not.toContain('Kraken Slayer')
    expect(userContent).not.toContain('Immortal Shieldbow')
  })

  it('uses specified aiModel when provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState, undefined, { aiModel: 'claude-haiku-4-5-20251001' })

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-haiku-4-5-20251001')
  })

  it('falls back to default model when aiModel not provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
  })

  it('includes CS and level in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(mockGameState)

    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content
    expect(userContent).toContain('CS 72')
    expect(userContent).toContain('Lv9')
  })

  it('uses event detail strings in prompt when available', async () => {
    const stateWithDetailEvents = {
      ...mockGameState,
      recentEvents: [{
        name: 'DragonKill',
        time: 300,
        relativeTime: '30s ago',
        category: 'objective' as const,
        detail: 'Enemy team took Fire Dragon'
      }]
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }]
    })

    await generateCoaching(stateWithDetailEvents)

    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content
    expect(userContent).toContain('Enemy team took Fire Dragon')
    expect(userContent).not.toContain('DragonKill')
  })
})

describe('callPerplexity', () => {
  let callPerplexity: (prompt: string, model: string, apiKey: string) => Promise<CoachingGoals>

  beforeEach(async () => {
    vi.resetModules()
    const coachModule = await import('../electron/main/coach')
    callPerplexity = coachModule.callPerplexity
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns CoachingGoals on valid Perplexity response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validResponse) } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callPerplexity('test prompt', 'sonar', 'pplx-test-key')
    expect(result).toMatchObject({
      personalGoals: expect.any(Array),
      teamGoals: expect.any(Array),
      gamePhase: expect.stringMatching(/^(early|mid|late)$/),
      matchupTip: expect.any(String)
    })
  })

  it('sends correct request to Perplexity API', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validResponse) } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    await callPerplexity('test prompt', 'sonar-pro', 'pplx-test-key')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.perplexity.ai/chat/completions')
    expect(options.method).toBe('POST')
    expect(options.headers['Authorization']).toBe('Bearer pplx-test-key')
    expect(options.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(options.body)
    expect(body.model).toBe('sonar-pro')
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('test prompt')
  })

  it('throws on non-2xx Perplexity response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key')
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(callPerplexity('test prompt', 'sonar', 'bad-key')).rejects.toThrow('Perplexity API error 401')
  })

  it('throws on non-JSON Perplexity response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Sure! Here are your coaching goals...' } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(callPerplexity('test prompt', 'sonar', 'pplx-test-key')).rejects.toThrow('non-JSON')
  })

  it('throws on empty Perplexity response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [] })
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(callPerplexity('test prompt', 'sonar', 'pplx-test-key')).rejects.toThrow('Empty response')
  })

  it('strips markdown code fences from Perplexity response', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: wrapped } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callPerplexity('test prompt', 'sonar', 'pplx-test-key')
    expect(result.personalGoals.length).toBe(2)
  })
})

describe('generateCoaching — Perplexity provider', () => {
  let generateCoaching: (state: GameState, ctx?: string, settings?: CoachingSettingsParam) => Promise<CoachingGoals>

  beforeEach(async () => {
    vi.resetModules()
    const coachModule = await import('../electron/main/coach')
    generateCoaching = coachModule.generateCoaching
  })

  afterEach(() => {
    delete process.env.PERPLEXITY_API_KEY
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('routes to Perplexity when aiProvider is perplexity', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validResponse) } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await generateCoaching(mockGameState, undefined, {
      aiProvider: 'perplexity',
      perplexityModel: 'sonar-pro',
      perplexityApiKey: 'pplx-test-key'
    })

    expect(result).toMatchObject({ personalGoals: expect.any(Array) })
    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('sonar-pro')
  })

  it('throws when PERPLEXITY_API_KEY is not set and not in settings', async () => {
    await expect(generateCoaching(mockGameState, undefined, {
      aiProvider: 'perplexity'
    })).rejects.toThrow('PERPLEXITY_API_KEY')
  })

  it('reads PERPLEXITY_API_KEY from env when not in settings', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-env-key'
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validResponse) } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await generateCoaching(mockGameState, undefined, {
      aiProvider: 'perplexity',
      perplexityModel: 'sonar'
    })

    expect(result).toMatchObject({ personalGoals: expect.any(Array) })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer pplx-env-key')
  })

  it('defaults to sonar model when perplexityModel not specified', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(validResponse) } }]
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    await generateCoaching(mockGameState, undefined, {
      aiProvider: 'perplexity',
      perplexityApiKey: 'pplx-test-key'
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('sonar')
  })
})

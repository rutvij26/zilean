import Anthropic from '@anthropic-ai/sdk'
import { GameState, CoachingGoals, ChampionContext, AppSettings } from '../../shared/types'

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6'
const DEFAULT_PERPLEXITY_MODEL = 'sonar'
const MAX_TOKENS = 700

const SYSTEM_PROMPT =
  'You are an expert League of Legends coach. Analyze live game state and generate short actionable goals. Take recent events seriously — a Baron kill or team fight loss changes priorities immediately.'

function formatChampCompact(c: ChampionContext): string {
  return `${c.championName}(${c.level})`
}

function buildTeamContextSection(state: GameState): string {
  const allyStr =
    state.allies.length > 0 ? state.allies.map(formatChampCompact).join(', ') : 'unknown'
  const enemyStr =
    state.enemies.length > 0 ? state.enemies.map(formatChampCompact).join(', ') : 'unknown'

  return `- Allies: ${allyStr}\n- Enemies: ${enemyStr}`
}

function buildMatchupTipInstruction(state: GameState): string {
  const opponentStr = state.laneOpponent
    ? `${state.laneOpponent.championName} (${state.laneOpponent.kills}/${state.laneOpponent.deaths}/${state.laneOpponent.assists})`
    : 'unknown opponent'

  if (state.abilities.r.level === 0 || parseGameTimeStr(state.gameTime) < 900) {
    return `In one sentence (max 15 words), give the most important lane tip for ${state.champion} vs ${opponentStr}.`
  }
  if (parseGameTimeStr(state.gameTime) < 1800) {
    return `In one sentence (max 15 words), give the most important mid-game tip for ${state.champion} — rotations, skirmishes, or objectives.`
  }
  return `In one sentence (max 15 words), give the most important late-game tip for ${state.champion} — teamfight, win conditions, or objectives.`
}

function parseGameTimeStr(gameTime: string): number {
  if (gameTime.includes(':')) {
    const parts = gameTime.split(':')
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  }
  return parseFloat(gameTime) || 0
}

function buildPrompt(state: GameState, historicalContext?: string): string {
  const eventsStr =
    state.recentEvents.length > 0
      ? state.recentEvents.map((e) => e.detail ?? e.name).join('; ')
      : 'none'
  const goldDiffStr = state.teamGoldDiff >= 0 ? `+${state.teamGoldDiff}` : `${state.teamGoldDiff}`

  const itemsStr =
    state.items.length > 0 ? state.items.map((i) => i.displayName).join(', ') : 'none'

  const abilitiesStr = `Q(${state.abilities.q.level}) W(${state.abilities.w.level}) E(${state.abilities.e.level}) R(${state.abilities.r.level})`

  const runesStr = `${state.runes.keystone} | ${state.runes.primaryTree}/${state.runes.secondaryTree}`

  const spellsStr = `${state.summonerSpells.spell1}+${state.summonerSpells.spell2}`

  const opponentStr = state.laneOpponent
    ? `${state.laneOpponent.championName} (${state.laneOpponent.kills}/${state.laneOpponent.deaths}/${state.laneOpponent.assists})`
    : 'unknown'

  const historicalSection = historicalContext
    ? `\nHistorical patterns:\n${historicalContext}\n`
    : ''

  const matchupTipInstruction = buildMatchupTipInstruction(state)
  const teamContext = buildTeamContextSection(state)

  const baronStatus = state.objectiveTimers.baronAvailable ? 'available' : 'not spawned'
  const heraldStatus = state.objectiveTimers.heraldAvailable ? 'available' : 'not spawned'
  const dragonStatus = state.objectiveTimers.dragonAvailableIn === 0
    ? 'available'
    : `${Math.round(state.objectiveTimers.dragonAvailableIn)}s`
  const baronBuff = state.buffDurations.baronBuffRemaining > 0
    ? `${Math.round(state.buffDurations.baronBuffRemaining)}s remaining`
    : 'none'
  const dragonBuff = state.buffDurations.dragonBuffRemaining > 0
    ? `${Math.round(state.buffDurations.dragonBuffRemaining)}s remaining`
    : 'none'
  const objectiveLine = `Baron: ${baronStatus} | Herald: ${heraldStatus} | Dragon: ${dragonStatus} | Baron buff: ${baronBuff} | Dragon buff: ${dragonBuff}`
  const awarenessLine = `Dead time: ${state.deadTimeTotal}s | ${state.abilityLevelHint}`

  return `State: ${state.champion} ${state.role} ${state.gameTime} | ${state.kills}/${state.deaths}/${state.assists} | ${state.gold}g | CS ${state.cs} | Lv${state.level}
Items: ${itemsStr}
Abilities: ${abilitiesStr} | ${runesStr} | ${spellsStr}
Opponent: ${opponentStr}
${teamContext}
Events: ${eventsStr} | Gold diff: ${goldDiffStr}
Objectives: ${objectiveLine}
Awareness: ${awarenessLine}${historicalSection}

Generate coaching goals for the next 3 minutes.
Suggest the single best next item considering gold (${state.gold}g), items built, enemy comp, and game phase.
${matchupTipInstruction}
Return ONLY valid JSON:
{"personalGoals":["goal1","goal2"],"personalTag":"<1-2 word label>","teamGoals":["goal1","goal2"],"teamTag":"<1-2 word label>","gamePhase":"early|mid|late","updatedAt":"${state.gameTime}","matchupTip":"<1 sentence max 20 words>","item":{"name":"<item>","reason":"<why>","goldNeeded":<int>}}
personalTag and teamTag: 1-2 words (e.g. "Farm", "Roam", "Peel").
matchupTip: exactly 1 sentence, max 20 words.
No explanation. No markdown. JSON only.`
}

function validateCoachingGoals(obj: unknown): CoachingGoals {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Response is not an object')
  }

  const data = obj as Record<string, unknown>

  if (!Array.isArray(data.personalGoals) || data.personalGoals.length !== 2) {
    throw new Error(`personalGoals must be an array of exactly 2 items, got: ${JSON.stringify(data.personalGoals)}`)
  }
  if (typeof data.personalTag !== 'string' || !data.personalTag.trim()) {
    throw new Error('personalTag must be a non-empty string')
  }
  if (!Array.isArray(data.teamGoals) || data.teamGoals.length !== 2) {
    throw new Error(`teamGoals must be an array of exactly 2 items, got: ${JSON.stringify(data.teamGoals)}`)
  }
  if (typeof data.teamTag !== 'string' || !data.teamTag.trim()) {
    throw new Error('teamTag must be a non-empty string')
  }
  if (!['early', 'mid', 'late'].includes(data.gamePhase as string)) {
    throw new Error(`gamePhase must be early|mid|late, got: ${data.gamePhase}`)
  }
  if (typeof data.updatedAt !== 'string') {
    throw new Error('updatedAt must be a string')
  }
  if (typeof data.matchupTip !== 'string' || !data.matchupTip.trim()) {
    throw new Error('matchupTip must be a non-empty string')
  }
  const words = data.matchupTip.trim().split(/\s+/)
  if (words.length > 20) {
    throw new Error(`matchupTip must be max 20 words, got ${words.length}`)
  }

  const result: CoachingGoals = {
    personalGoals: data.personalGoals as string[],
    personalTag: (data.personalTag as string).trim(),
    teamGoals: data.teamGoals as string[],
    teamTag: (data.teamTag as string).trim(),
    gamePhase: data.gamePhase as 'early' | 'mid' | 'late',
    updatedAt: data.updatedAt as string,
    matchupTip: data.matchupTip.trim()
  }

  if (data.item !== undefined) {
    const item = data.item as Record<string, unknown>
    if (typeof item.name !== 'string' || typeof item.reason !== 'string' || typeof item.goldNeeded !== 'number') {
      throw new Error('item must have name (string), reason (string), goldNeeded (number)')
    }
    result.item = { name: item.name, reason: item.reason, goldNeeded: item.goldNeeded }
  }

  if (data.backTiming !== undefined) {
    const bt = data.backTiming as Record<string, unknown>
    if (typeof bt.suggestion !== 'string' || typeof bt.goldTarget !== 'number') {
      throw new Error('backTiming must have suggestion (string), goldTarget (number)')
    }
    result.backTiming = { suggestion: bt.suggestion, goldTarget: bt.goldTarget }
  }

  return result
}

export async function callClaude(prompt: string, model: string, apiKey: string): Promise<CoachingGoals> {
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  const text = content.text.trim()
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }

  return validateCoachingGoals(parsed)
}

export async function callPerplexity(prompt: string, model: string, apiKey: string): Promise<CoachingGoals> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: MAX_TOKENS
    })
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Perplexity API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('Empty response from Perplexity')
  }

  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Perplexity returned non-JSON response: ${text.slice(0, 200)}`)
  }

  return validateCoachingGoals(parsed)
}

type CoachingSettingsParam = Pick<AppSettings, 'aiProvider' | 'aiModel' | 'perplexityModel' | 'perplexityApiKey'>

export async function generateCoaching(
  state: GameState,
  historicalContext?: string,
  settings?: Partial<CoachingSettingsParam>
): Promise<CoachingGoals> {
  const provider = settings?.aiProvider ?? 'claude'
  const prompt = buildPrompt(state, historicalContext)

  if (provider === 'perplexity') {
    const apiKey = settings?.perplexityApiKey || process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set')
    }
    const model = settings?.perplexityModel ?? DEFAULT_PERPLEXITY_MODEL
    return callPerplexity(prompt, model, apiKey)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const model = settings?.aiModel ?? DEFAULT_CLAUDE_MODEL
  return callClaude(prompt, model, apiKey)
}

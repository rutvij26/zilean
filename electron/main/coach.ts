import Anthropic from '@anthropic-ai/sdk'
import { GameState, CoachingGoals } from '../../shared/types'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 512

function buildPrompt(state: GameState, historicalContext?: string): string {
  const eventsStr = state.recentEvents.length > 0 ? state.recentEvents.join(', ') : 'none'
  const goldDiffStr = state.teamGoldDiff >= 0
    ? `+${state.teamGoldDiff}`
    : `${state.teamGoldDiff}`

  const historicalSection = historicalContext
    ? `\nHistorical patterns:\n${historicalContext}\n`
    : ''

  return `Game state:
- Champion: ${state.champion}, Role: ${state.role}
- Game time: ${state.gameTime}
- Score: ${state.kills}/${state.deaths}/${state.assists}
- Gold: ${state.gold}
- Recent events: ${eventsStr}
- Team gold difference: ${goldDiffStr}${historicalSection}

Generate coaching goals for the next 3 minutes.
Return ONLY valid JSON:
{"personalGoals":["goal1","goal2"],"teamGoals":["goal1","goal2"],"gamePhase":"early|mid|late","updatedAt":"${state.gameTime}"}
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
  if (!Array.isArray(data.teamGoals) || data.teamGoals.length !== 2) {
    throw new Error(`teamGoals must be an array of exactly 2 items, got: ${JSON.stringify(data.teamGoals)}`)
  }
  if (!['early', 'mid', 'late'].includes(data.gamePhase as string)) {
    throw new Error(`gamePhase must be early|mid|late, got: ${data.gamePhase}`)
  }
  if (typeof data.updatedAt !== 'string') {
    throw new Error('updatedAt must be a string')
  }

  return {
    personalGoals: data.personalGoals as string[],
    teamGoals: data.teamGoals as string[],
    gamePhase: data.gamePhase as 'early' | 'mid' | 'late',
    updatedAt: data.updatedAt as string
  }
}

export async function generateCoaching(
  state: GameState,
  historicalContext?: string
): Promise<CoachingGoals> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are an expert League of Legends coach with deep knowledge of all roles, champions, and macro strategy. You analyze live game state and generate short actionable goals. When historical patterns are provided, weave them naturally into coaching goals with supporting evidence counts (e.g., "Avoid X — you did this in 6/10 similar games").`,
    messages: [
      {
        role: 'user',
        content: buildPrompt(state, historicalContext)
      }
    ]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  const text = content.text.trim()

  // Strip markdown code fences if present
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }

  return validateCoachingGoals(parsed)
}

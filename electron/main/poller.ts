import * as https from 'https'
import { GameState } from '../../shared/types'

const RIOT_LIVE_API = 'https://127.0.0.1:2999/liveclientdata'
const POLL_INTERVAL_MS = 60_000
const GOLD_DIFF_THRESHOLD = 500

let pollTimer: NodeJS.Timeout | null = null

interface RiotPlayerData {
  summonerName: string
  championName: string
  position: string
  scores: { kills: number; deaths: number; assists: number }
  currentGold: number
  team: string
}

interface RiotGameData {
  gameTime: number
  events: { Events: RiotEvent[] }
  allPlayers: RiotPlayerData[]
  activePlayer: {
    summonerName: string
    championStats: { currentGold: number }
  }
}

interface RiotEvent {
  EventName: string
  EventTime: number
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'))
    })
  })
}

async function fetchAllData(): Promise<RiotGameData | null> {
  try {
    const [gameDataRaw, eventsRaw, playersRaw, activePlayerRaw] = await Promise.all([
      httpsGet(`${RIOT_LIVE_API}/gamestats`),
      httpsGet(`${RIOT_LIVE_API}/eventdata`),
      httpsGet(`${RIOT_LIVE_API}/playerlist`),
      httpsGet(`${RIOT_LIVE_API}/activeplayer`)
    ])

    console.log('[poller] Raw gamestats:', gameDataRaw.slice(0, 100))

    const gameData = JSON.parse(gameDataRaw)
    const events = JSON.parse(eventsRaw)
    const allPlayers = JSON.parse(playersRaw)
    const activePlayer = JSON.parse(activePlayerRaw)

    // Normalise events — some endpoints return { Events: [] }, others return { events: [] }
    const eventsList: RiotEvent[] = events.Events ?? events.events ?? []

    return {
      gameTime: gameData.gameTime ?? gameData.gameLength ?? 0,
      events: { Events: eventsList },
      allPlayers,
      activePlayer
    }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND'
    ) {
      console.log('[poller] Game not running — connection refused')
      return null
    }
    if (error.message?.includes('timed out')) {
      console.log('[poller] Game not running — timeout')
      return null
    }
    // Parse errors, shape mismatches, etc. — log full error so we can diagnose
    console.error('[poller] Error fetching game data:', error.message, error.stack)
    return null
  }
}

export function extractRecentEvents(events: RiotEvent[], gameTime: number): string[] {
  const relevant = ['DragonKill', 'BaronKill', 'TurretKilled', 'ChampionKill', 'InhibitorKilled']
  return events
    .filter((e) => relevant.includes(e.EventName) && gameTime - e.EventTime <= 120)
    .slice(-10)
    .map((e) => e.EventName)
}

export function computeTeamGoldDiff(players: RiotPlayerData[], summonerName: string): number {
  const activePlayer = players.find((p) => p.summonerName === summonerName)
  if (!activePlayer) return 0
  const myTeam = activePlayer.team

  let allyGold = 0
  let enemyGold = 0
  for (const player of players) {
    if (player.team === myTeam) {
      allyGold += player.currentGold
    } else {
      enemyGold += player.currentGold
    }
  }
  return allyGold - enemyGold
}

export function detectMeaningfulChange(
  prev: GameState | null,
  next: GameState
): boolean {
  if (!prev) return true

  if (next.deaths > prev.deaths) return true
  if (next.kills > prev.kills) return true

  const newEvents = next.recentEvents.filter((e) => !prev.recentEvents.includes(e))
  if (newEvents.some((e) => ['DragonKill', 'BaronKill', 'TurretKilled'].includes(e))) return true

  const prevPhase = getGamePhase(prev.gameTime)
  const nextPhase = getGamePhase(next.gameTime)
  if (prevPhase !== nextPhase) return true

  if (Math.abs(next.teamGoldDiff - prev.teamGoldDiff) > GOLD_DIFF_THRESHOLD) return true

  return false
}

function getGamePhase(gameTime: string): 'early' | 'mid' | 'late' {
  const seconds = parseGameTime(gameTime)
  if (seconds < 900) return 'early'   // < 15 min
  if (seconds < 1800) return 'mid'    // 15–30 min
  return 'late'
}

function parseGameTime(gameTime: string): number {
  // "mm:ss" format takes priority to avoid parseFloat('16:00') → 16
  if (gameTime.includes(':')) {
    const parts = gameTime.split(':')
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  }
  // gameTime from Riot is in seconds as a float
  const asFloat = parseFloat(gameTime)
  return isNaN(asFloat) ? 0 : asFloat
}

export function formatGameTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function poll(callback: (state: GameState | null) => void): Promise<void> {
  const data = await fetchAllData()
  if (!data) {
    callback(null)
    return
  }

  try {
    const summonerName = data.activePlayer.summonerName
    const activePlayerFull = data.allPlayers.find((p) => p.summonerName === summonerName)
    if (!activePlayerFull) {
      callback(null)
      return
    }

    const gameState: GameState = {
      champion: activePlayerFull.championName,
      role: activePlayerFull.position || 'UNKNOWN',
      gameTime: formatGameTime(data.gameTime),
      kills: activePlayerFull.scores.kills,
      deaths: activePlayerFull.scores.deaths,
      assists: activePlayerFull.scores.assists,
      gold: activePlayerFull.currentGold,
      teamGoldDiff: computeTeamGoldDiff(data.allPlayers, summonerName),
      recentEvents: extractRecentEvents(data.events.Events, data.gameTime),
      summonerName
    }

    callback(gameState)
  } catch (err) {
    console.error('[poller] Failed to parse game state:', err)
    callback(null)
  }
}

export function startPolling(callback: (state: GameState | null) => void): void {
  if (pollTimer) return
  // Fire immediately on start
  poll(callback)
  pollTimer = setInterval(() => poll(callback), POLL_INTERVAL_MS)
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// Exported for testing
export { getGamePhase, parseGameTime }

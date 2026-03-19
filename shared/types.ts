export interface GameEvent {
  name: string
  time: number          // event time in game-seconds
  relativeTime: string  // e.g. "8s ago"
  category: 'kill' | 'objective' | 'structure' | 'economy' | 'vision' | 'game'
  detail?: string       // e.g. "You killed Yasuo", "Enemy team took Fire Dragon"
}

export interface PlayerItem {
  displayName: string
  itemID: number
  slot: number
  count: number
  price: number
}

export interface PlayerAbilities {
  q: { displayName: string; level: number }
  w: { displayName: string; level: number }
  e: { displayName: string; level: number }
  r: { displayName: string; level: number }
  passive: { displayName: string }
}

export interface PlayerRunes {
  keystone: string       // e.g. "Electrocute"
  primaryTree: string    // e.g. "Domination"
  secondaryTree: string  // e.g. "Sorcery"
}

export interface LaneOpponent {
  championName: string
  kills: number
  deaths: number
  assists: number
}

export interface ChampionContext {
  championName: string
  items: string[]  // displayNames only — keeps GameState lean
  level: number
}

export interface ObjectiveTimers {
  baronAvailable: boolean      // game time >= 1200s (20 min)
  heraldAvailable: boolean     // game time >= 480s and < 1200s (8-20 min)
  dragonAvailableIn: number    // seconds until next dragon (0 if available)
}

export interface BuffDurations {
  baronBuffRemaining: number   // seconds, 0 if none
  dragonBuffRemaining: number  // seconds, 0 if none
}

export interface GameState {
  champion: string
  role: string
  gameMode: string
  gameTime: string
  kills: number
  deaths: number
  assists: number
  gold: number
  teamGoldDiff: number
  recentEvents: GameEvent[]
  summonerName: string
  items: PlayerItem[]
  abilities: PlayerAbilities
  runes: PlayerRunes
  summonerSpells: { spell1: string; spell2: string }
  laneOpponent: LaneOpponent | null
  allies: ChampionContext[]   // all allied champions (excluding self)
  enemies: ChampionContext[]  // all enemy champions
  cs: number          // creep score
  wardScore: number   // vision score
  level: number       // champion level
  objectiveTimers: ObjectiveTimers
  buffDurations: BuffDurations
  deadTimeTotal: number        // total seconds dead this game
  abilityLevelHint: string     // e.g. "Level W next (rank 1 priority)"
}

export interface LiveStats {
  csPerMin: number
  goldPerMin: number
  kdaRatio: number
  deathsPer10Min: number
  killParticipation: number       // % 0-100
  killShare: number               // % of team kills
  assistShare: number
  goldDiffTrend: 'gaining' | 'losing' | 'stable'
  goldUnspent: number
  totalGoldInItems: number
  goldEfficiency: number          // % of total gold converted to items
  wardsPlaced: number
  wardsKilled: number
  wardScore: number
  dragonControl: number           // ally dragons / total dragons %
  turretsDestroyed: number
  inhibitorsDestroyed: number
  timeAlivePercent: number
  currentStreak: 'killing' | 'on fire' | 'none'
  gamePhase: 'early' | 'mid' | 'late'
  itemSlotsUsed: number
  abilityPointsUsed: number
}

export interface LiveStatsUpdate {
  stats: LiveStats
}

export interface ItemSuggestion {
  name: string
  reason: string
  goldNeeded: number
}

export interface BackTiming {
  suggestion: string
  goldTarget: number
}

export interface CoachingGoals {
  personalGoals: string[]  // exactly 2
  teamGoals: string[]       // exactly 2
  personalTag: string       // 1-2 word AI summary of personal goals
  teamTag: string           // 1-2 word AI summary of team goals
  gamePhase: 'early' | 'mid' | 'late'
  updatedAt: string
  matchupTip: string        // exactly 1 sentence, always present during active game
  item?: ItemSuggestion
  backTiming?: BackTiming
}

export type CoachingStatus = 'waiting' | 'active' | 'error'

export interface CoachingUpdate {
  status: CoachingStatus
  goals?: CoachingGoals | null
  error?: string
  champion?: string
  gameMode?: string
}

export interface EventsUpdate {
  events: GameEvent[]
}

export interface AwarenessUpdate {
  objectiveTimers: ObjectiveTimers
  buffDurations: BuffDurations
  deadTimeTotal: number
  abilityLevelHint: string
}

export interface AppSettings {
  anthropicApiKey: string
  overlayVisible: boolean
  summonerName?: string
  overlayTheme: 'lol-native' | 'minimal' | 'sidebar'
  aiModel: string                        // claude-haiku-4-5-20251001 | claude-sonnet-4-6 | claude-opus-4-6
  coachingIntervalSecs: number           // 60 | 90 | 120 | 180 | 300
  eventCoachingEnabled: boolean
  eventCoachingSensitivity: 'major' | 'all'  // major = baron/dragon/inhib; all = + kills
  showLiveStats: boolean
  showEventFeed: boolean
  showMatchupTip: boolean
}

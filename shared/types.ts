export interface GameState {
  champion: string
  role: string
  gameTime: string
  kills: number
  deaths: number
  assists: number
  gold: number
  teamGoldDiff: number
  recentEvents: string[]
  summonerName: string
}

export interface CoachingGoals {
  personalGoals: string[]  // exactly 2
  teamGoals: string[]       // exactly 2
  gamePhase: 'early' | 'mid' | 'late'
  updatedAt: string
}

export type CoachingStatus = 'waiting' | 'active' | 'error'

export interface CoachingUpdate {
  status: CoachingStatus
  goals?: CoachingGoals | null
  error?: string
}

export interface AppSettings {
  anthropicApiKey: string
  overlayVisible: boolean
  summonerName?: string
}

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  overlayVisible: true,
  summonerName: '',
  overlayTheme: 'lol-native',
  aiModel: 'claude-sonnet-4-6',
  coachingIntervalSecs: 90,
  eventCoachingEnabled: true,
  eventCoachingSensitivity: 'major',
  showLiveStats: true,
  showEventFeed: true,
  showMatchupTip: true,
  overlayX: undefined,
  overlayY: undefined,
  autoUpdate: true
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath()
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath()
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function storeSummonerName(name: string): void {
  const settings = loadSettings()
  if (settings.summonerName !== name) {
    saveSettings({ ...settings, summonerName: name })
  }
}

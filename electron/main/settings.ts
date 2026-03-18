import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  overlayVisible: true,
  summonerName: ''
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

/// <reference types="vite/client" />

import { AppSettings, CoachingUpdate } from '../../../shared/types'

interface ElectronAPI {
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>
  toggleOverlay: () => Promise<void>
  onCoachingUpdate: (callback: (update: CoachingUpdate) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

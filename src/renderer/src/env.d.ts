/// <reference types="vite/client" />

import { AppSettings, CoachingUpdate, EventsUpdate, LiveStatsUpdate, AwarenessUpdate, UpdateNotification } from '../../../shared/types'

interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  getVersion: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>
  toggleOverlay: () => Promise<void>
  onCoachingUpdate: (callback: (update: CoachingUpdate) => void) => () => void
  resizeOverlay: (height: number) => void
  onEventsUpdate: (callback: (update: EventsUpdate) => void) => () => void
  onLiveStatsUpdate: (callback: (update: LiveStatsUpdate) => void) => () => void
  onAwarenessUpdate: (callback: (update: AwarenessUpdate) => void) => () => void
  onNavigateTo: (callback: (view: string) => void) => () => void
  dumpSwagger: () => Promise<{ success: boolean; error?: string }>
  overlay?: {
    setIgnoreMouseEvents: (ignore: boolean) => Promise<void>
    savePosition: () => Promise<void>
  }
  onUpdateStatus: (callback: (note: UpdateNotification) => void) => () => void
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

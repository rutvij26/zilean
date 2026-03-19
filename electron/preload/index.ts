import { contextBridge, ipcRenderer } from 'electron'
import { AppSettings, CoachingUpdate, EventsUpdate, LiveStatsUpdate } from '../../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-settings', settings),

  toggleOverlay: (): Promise<void> => ipcRenderer.invoke('toggle-overlay'),

  onCoachingUpdate: (callback: (update: CoachingUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: CoachingUpdate): void =>
      callback(update)
    ipcRenderer.on('coaching-update', handler)
    return () => ipcRenderer.removeListener('coaching-update', handler)
  },

  resizeOverlay: (height: number): void => ipcRenderer.send('resize-overlay', height),

  onEventsUpdate: (callback: (update: EventsUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: EventsUpdate): void =>
      callback(update)
    ipcRenderer.on('events-update', handler)
    return () => ipcRenderer.removeListener('events-update', handler)
  },

  onLiveStatsUpdate: (callback: (update: LiveStatsUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: LiveStatsUpdate): void =>
      callback(update)
    ipcRenderer.on('live-stats-update', handler)
    return () => ipcRenderer.removeListener('live-stats-update', handler)
  },

  onNavigateTo: (callback: (view: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, view: string): void => callback(view)
    ipcRenderer.on('navigate-to', handler)
    return () => ipcRenderer.removeListener('navigate-to', handler)
  },

  dumpSwagger: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('dump-swagger')
})

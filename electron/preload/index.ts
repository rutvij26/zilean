import { contextBridge, ipcRenderer } from 'electron'
import { AppSettings, CoachingUpdate } from '../../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-settings', settings),

  toggleOverlay: (): Promise<void> => ipcRenderer.invoke('toggle-overlay'),

  onCoachingUpdate: (callback: (update: CoachingUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: CoachingUpdate): void =>
      callback(update)
    ipcRenderer.on('coaching-update', handler)
    return () => ipcRenderer.removeListener('coaching-update', handler)
  }
})

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  screen,
  nativeImage
} from 'electron'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { startPolling, stopPolling, detectMeaningfulChange } from './poller'
import { generateCoaching } from './coach'
import { loadSettings, saveSettings, storeSummonerName } from './settings'
import { GameState, CoachingGoals, CoachingUpdate } from '../../shared/types'

dotenv.config()

const FORCE_INTERVAL_MS = 180_000 // 3 minutes

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

let cachedGoals: CoachingGoals | null = null
let prevState: GameState | null = null
let lastCoachTime = 0

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'Zilean — LoL Coach',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createOverlayWindow(): BrowserWindow {
  const { width: workW } = screen.getPrimaryDisplay().workAreaSize
  const OVERLAY_WIDTH = 300
  const OVERLAY_HEIGHT = 400

  const win = new BrowserWindow({
    x: workW - OVERLAY_WIDTH - 20,
    y: 20,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=true`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { overlay: 'true' }
    })
  }

  return win
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: 500,
    height: 400,
    title: 'Zilean — Settings',
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?settings=true`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { settings: 'true' }
    })
  }

  win.on('closed', () => { settingsWindow = null })
  settingsWindow = win
  return win
}

function createTray(): void {
  // Use a blank icon for now (no resources in scaffold)
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Zilean — LoL Coach')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Main Window', click: () => mainWindow?.show() },
    {
      label: 'Toggle Overlay',
      click: () => {
        if (overlayWindow) {
          overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show()
        }
      }
    },
    { label: 'Settings', click: () => { settingsWindow = createSettingsWindow() } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
}

function sendOverlayUpdate(update: CoachingUpdate): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('coaching-update', update)
  }
}

async function handleGameState(gameState: GameState | null): Promise<void> {
  if (!gameState) {
    sendOverlayUpdate({ status: 'waiting' })
    prevState = null
    lastCoachTime = 0
    return
  }

  // Auto-store summoner name on first game detection
  if (!prevState) {
    storeSummonerName(gameState.summonerName)
    // Update env for Claude
    if (!process.env.ANTHROPIC_API_KEY) {
      const settings = loadSettings()
      if (settings.anthropicApiKey) {
        process.env.ANTHROPIC_API_KEY = settings.anthropicApiKey
      }
    }
  }

  const changed = detectMeaningfulChange(prevState, gameState)
  const forceDue = Date.now() - lastCoachTime > FORCE_INTERVAL_MS

  if (!changed && !forceDue) return

  prevState = gameState

  try {
    const goals = await generateCoaching(gameState)
    cachedGoals = goals
    lastCoachTime = Date.now()
    sendOverlayUpdate({ status: 'active', goals })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[main] Coach error:', message)
    sendOverlayUpdate({ status: 'error', goals: cachedGoals, error: message })
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('get-settings', () => loadSettings())

  ipcMain.handle('save-settings', (_event, settings) => {
    saveSettings(settings)
    // Apply API key immediately if provided
    if (settings.anthropicApiKey) {
      process.env.ANTHROPIC_API_KEY = settings.anthropicApiKey
    }
    return { success: true }
  })

  ipcMain.handle('toggle-overlay', () => {
    if (overlayWindow) {
      overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show()
    }
  })
}

app.whenReady().then(() => {
  // Load API key from saved settings if not already in env
  if (!process.env.ANTHROPIC_API_KEY) {
    const saved = loadSettings()
    if (saved.anthropicApiKey) {
      process.env.ANTHROPIC_API_KEY = saved.anthropicApiKey
      console.log('[main] Loaded API key from settings')
    } else {
      console.warn('[main] No ANTHROPIC_API_KEY found — open Settings (Alt+,) to add one')
    }
  }

  mainWindow = createMainWindow()
  overlayWindow = createOverlayWindow()
  createTray()
  registerIpcHandlers()

  // Register global shortcuts
  globalShortcut.register('Alt+C', () => {
    if (overlayWindow) {
      overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show()
    }
  })

  globalShortcut.register('Alt+,', () => {
    settingsWindow = createSettingsWindow()
  })

  // Start the game polling loop
  startPolling(handleGameState)

  // Initial waiting state
  setTimeout(() => sendOverlayUpdate({ status: 'waiting' }), 1000)
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux
  if (process.platform === 'darwin') app.quit()
})

app.on('will-quit', () => {
  stopPolling()
  globalShortcut.unregisterAll()
})

// Export for testing
export { handleGameState, cachedGoals }

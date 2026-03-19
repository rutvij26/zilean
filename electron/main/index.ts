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
import { autoUpdater } from 'electron-updater'
import {
  startPolling,
  stopPolling,
  hasStateChangedSince,
  resetFingerprintState,
  pollEvents,
  resetEventState,
  triggerPoll,
  EVENT_POLL_INTERVAL_MS
} from './poller'
import { generateCoaching } from './coach'
import { loadSettings, saveSettings, storeSummonerName } from './settings'
import { computeLiveStats } from './liveStats'
import { dumpSwagger } from './swaggerDump'
import {
  GameState,
  GameEvent,
  CoachingGoals,
  CoachingUpdate,
  EventsUpdate,
  LiveStatsUpdate,
  AppSettings
} from '../../shared/types'

dotenv.config()

// Major events trigger coaching regardless of sensitivity setting
const MAJOR_EVENTS = new Set(['DragonKill', 'BaronKill', 'InhibitorKilled'])
// All significant events (used when sensitivity = 'all')
const ALL_SIGNIFICANT_EVENTS = new Set([
  'ChampionKill', 'FirstBlood', 'DragonKill', 'BaronKill', 'InhibitorKilled'
])

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let hoverPollTimer: NodeJS.Timeout | null = null

let cachedGoals: CoachingGoals | null = null
let prevState: GameState | null = null
let lastCoachTime = 0
let allGameEvents: GameEvent[] = []
let eventPollTimer: NodeJS.Timeout | null = null

// Current runtime settings (refreshed on save)
let runtimeSettings: AppSettings = loadSettings()

// Event-triggered coaching: minimum gap between event-driven coach calls
const EVENT_COACH_COOLDOWN_MS = 45_000
let lastEventCoachTime = 0

function getForceIntervalMs(): number {
  return (runtimeSettings.coachingIntervalSecs ?? 90) * 1000
}

function getSignificantEventSet(): Set<string> {
  return runtimeSettings.eventCoachingSensitivity === 'all'
    ? ALL_SIGNIFICANT_EVENTS
    : MAJOR_EVENTS
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    title: 'Zilean — LoL Coach',
    frame: false,
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
  const OVERLAY_HEIGHT = 50

  const savedSettings = loadSettings()
  const savedX = savedSettings.overlayX
  const savedY = savedSettings.overlayY

  const win = new BrowserWindow({
    x: savedX !== undefined ? savedX : workW - OVERLAY_WIDTH - 20,
    y: savedY !== undefined ? savedY : 50,
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

  win.on('moved', () => {
    const [x, y] = win.getPosition()
    const current = loadSettings()
    saveSettings({ ...current, overlayX: x, overlayY: y })
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=true`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { overlay: 'true' }
    })
  }

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
    {
      label: 'Settings',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
        mainWindow?.webContents.send('navigate-to', 'settings')
      }
    },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdates() },
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

function broadcastEventsUpdate(events: GameEvent[]): void {
  const update: EventsUpdate = { events: events.slice(-20) }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('events-update', update)
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('events-update', update)
  }
}

function broadcastLiveStats(state: GameState): void {
  const stats = computeLiveStats(state, allGameEvents)
  const update: LiveStatsUpdate = { stats }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('live-stats-update', update)
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('live-stats-update', update)
  }
}

function startEventPolling(): void {
  if (eventPollTimer) return
  eventPollTimer = setInterval(async () => {
    const newEvents = await pollEvents()
    if (newEvents.length > 0) {
      allGameEvents = [...allGameEvents, ...newEvents].slice(-100)
      broadcastEventsUpdate(allGameEvents)

      if (!runtimeSettings.eventCoachingEnabled) return

      // Trigger immediate coaching update when significant events occur
      const significantSet = getSignificantEventSet()
      const hasSignificant = newEvents.some((e) => significantSet.has(e.name))
      if (hasSignificant && Date.now() - lastEventCoachTime > EVENT_COACH_COOLDOWN_MS) {
        lastEventCoachTime = Date.now()
        console.log('[main] Significant event detected — triggering immediate coaching update')
        triggerPoll(handleGameState)
      }
    }
  }, EVENT_POLL_INTERVAL_MS)
}

async function handleGameState(gameState: GameState | null): Promise<void> {
  if (!gameState) {
    sendOverlayUpdate({ status: 'waiting' })
    if (prevState !== null) {
      // Game just ended — reset event state and clear feed
      allGameEvents = []
      resetEventState()
      resetFingerprintState()
      broadcastEventsUpdate([])
    }
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

  // Always broadcast live stats on every poll (no Claude needed)
  broadcastLiveStats(gameState)

  const fingerprintChanged = hasStateChangedSince(gameState)
  const forceDue = Date.now() - lastCoachTime > getForceIntervalMs()

  if (!fingerprintChanged && !forceDue) {
    prevState = gameState
    return
  }

  prevState = gameState

  const meta = { champion: gameState.champion, gameMode: gameState.gameMode }

  try {
    const goals = await generateCoaching(
      gameState,
      undefined,
      runtimeSettings.aiModel
    )
    cachedGoals = goals
    lastCoachTime = Date.now()
    sendOverlayUpdate({ status: 'active', goals, ...meta })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[main] Coach error:', message)
    sendOverlayUpdate({ status: 'error', goals: cachedGoals, error: message, ...meta })
  }
}

function registerIpcHandlers(): void {
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window-close', () => mainWindow?.close())

  ipcMain.on('resize-overlay', (_event, height: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setContentSize(300, Math.max(50, Math.ceil(height)))
    }
  })

  ipcMain.handle('get-settings', () => loadSettings())

  ipcMain.handle('save-settings', (_event, settings) => {
    saveSettings(settings)
    runtimeSettings = settings
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

  ipcMain.handle('overlay:setIgnoreMouseEvents', (_event, ignore: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  ipcMain.handle('overlay:savePosition', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition()
      const current = loadSettings()
      saveSettings({ ...current, overlayX: x, overlayY: y })
    }
  })

  // Dev-only: dump live Swagger spec from the running game client
  ipcMain.handle('dump-swagger', async () => {
    try {
      await dumpSwagger()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[main] dump-swagger failed:', message)
      return { success: false, error: message }
    }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

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

  // Auto-update (production only — skipped in dev)
  if (!process.env['ELECTRON_RENDERER_URL']) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  // Toggle mouse passthrough so overlay sections are clickable when hovered
  let overlayInteractive = false
  hoverPollTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return
    const cursor = screen.getCursorScreenPoint()
    const bounds = overlayWindow.getBounds()
    const isOver =
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height
    if (isOver !== overlayInteractive) {
      overlayInteractive = isOver
      overlayWindow.setIgnoreMouseEvents(!isOver, { forward: true })
    }
  }, 100)

  // Register global shortcuts
  globalShortcut.register('Alt+C', () => {
    if (overlayWindow) {
      overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show()
    }
  })

  globalShortcut.register('Alt+,', () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('navigate-to', 'settings')
  })

  // Start the game polling loops
  startPolling(handleGameState)
  startEventPolling()

  // Initial waiting state
  setTimeout(() => sendOverlayUpdate({ status: 'waiting' }), 1000)
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux
  if (process.platform === 'darwin') app.quit()
})

app.on('will-quit', () => {
  stopPolling()
  if (eventPollTimer) clearInterval(eventPollTimer)
  if (hoverPollTimer) clearInterval(hoverPollTimer)
  globalShortcut.unregisterAll()
})

// Export for testing
export { handleGameState, cachedGoals }

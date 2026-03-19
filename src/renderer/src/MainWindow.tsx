import React, { useEffect, useRef, useState } from 'react'
import { AppSettings, GameEvent, LiveStats } from '../../../shared/types'
import { EventFeed } from './components/EventFeed'
import { Settings } from './Settings'
import './styles/main.css'

type NavView = 'dashboard' | 'settings'

function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const maximizedRef = useRef(maximized)
  maximizedRef.current = maximized

  function handleMaximize(): void {
    window.electronAPI?.maximizeWindow()
    setMaximized(!maximizedRef.current)
  }

  return (
    <div className="title-bar">
      <div className="title-bar-sidebar" />
      <div className="title-bar-content">
        <div className="title-bar-drag" />
        <div className="title-bar-controls">
          <button
            className="title-btn minimize"
            onClick={() => window.electronAPI?.minimizeWindow()}
            title="Minimize"
          >
            <span>&#8211;</span>
          </button>
          <button
            className="title-btn maximize"
            onClick={handleMaximize}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            <span>{maximized ? '⧉' : '□'}</span>
          </button>
          <button
            className="title-btn close"
            onClick={() => window.electronAPI?.closeWindow()}
            title="Close"
          >
            <span>&#10005;</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  view,
  onNavigate,
  apiConnected
}: {
  view: NavView
  onNavigate: (v: NavView) => void
  apiConnected: boolean
}): JSX.Element {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">
          <span className="sidebar-logo-icon">⚔</span>
          <span>Zilean</span>
        </div>
        <div className="sidebar-logo-sub">LoL AI Coach</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-header">Coach</div>
        <div
          className={`nav-item${view === 'dashboard' ? ' active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-icon">◈</span>
          Dashboard
        </div>

        <div className="nav-section-header">App</div>
        <div
          className={`nav-item${view === 'settings' ? ' active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="nav-icon">◎</span>
          Settings
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className={`status-indicator${apiConnected ? ' connected' : ' disconnected'}`} />
        <div className="sidebar-footer-info">
          <span className="sidebar-footer-label">
            {apiConnected ? 'API Connected' : 'No API Key'}
          </span>
          {!apiConnected && (
            <span className="sidebar-footer-hint">Add key in Settings</span>
          )}
        </div>
      </div>
    </aside>
  )
}

function LiveStatsCard({ stats }: { stats: LiveStats }): JSX.Element {
  const trendIcon =
    stats.goldDiffTrend === 'gaining' ? '▲' : stats.goldDiffTrend === 'losing' ? '▼' : '—'
  const trendClass =
    stats.goldDiffTrend === 'gaining' ? 'green' : stats.goldDiffTrend === 'losing' ? 'red' : ''

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Live Stats</span>
        {stats.currentStreak !== 'none' && (
          <span className={`streak-badge${stats.currentStreak === 'on fire' ? ' on-fire' : ''}`}>
            {stats.currentStreak === 'on fire' ? '🔥 On Fire' : '⚔ Killing'}
          </span>
        )}
        <span className={`phase-tag ${stats.gamePhase}`}>{stats.gamePhase}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-cell">
          <span className="stat-label">KDA</span>
          <span className="stat-value">{stats.kdaRatio.toFixed(1)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">CS/min</span>
          <span className="stat-value">{stats.csPerMin.toFixed(1)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Kill Part.</span>
          <span className="stat-value">{stats.killParticipation}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Gold/min</span>
          <span className="stat-value">{stats.goldPerMin}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Unspent</span>
          <span className="stat-value">{stats.goldUnspent}g</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Items</span>
          <span className="stat-value">{stats.itemSlotsUsed}/6</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Wards ↑↓</span>
          <span className="stat-value">{stats.wardsPlaced}/{stats.wardsKilled}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Gold Inv.</span>
          <span className="stat-value">{(stats.totalGoldInItems / 1000).toFixed(1)}k</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Efficiency</span>
          <span className="stat-value">{stats.goldEfficiency}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Dragon Ctrl</span>
          <span className="stat-value">{stats.dragonControl}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Towers</span>
          <span className="stat-value">{stats.turretsDestroyed}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Alive</span>
          <span className="stat-value">{stats.timeAlivePercent}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Gold Trend</span>
          <span className={`stat-value ${trendClass}`}>{trendIcon} {stats.goldDiffTrend}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">D/10min</span>
          <span className="stat-value">{stats.deathsPer10Min.toFixed(1)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Ability Pts</span>
          <span className="stat-value">{stats.abilityPointsUsed}</span>
        </div>
      </div>
    </div>
  )
}

function DashboardView({
  events,
  liveStats
}: {
  events: GameEvent[]
  liveStats: LiveStats | null
}): JSX.Element {
  const hasGame = liveStats !== null

  return (
    <>
      <div className="card">
        <div className="card-title">Status</div>
        <div className="status-row">
          <div className="status-pill">
            <span className="status-dot green" />
            <span>Running</span>
          </div>
          <div className="keyboard-hints">
            <span className="kbd-hint"><kbd>Alt+C</kbd> Toggle overlay</span>
            <span className="kbd-hint"><kbd>Alt+,</kbd> Settings</span>
          </div>
        </div>
        {!hasGame && (
          <div className="waiting-hint">
            Start a League of Legends game to see coaching and live stats.
          </div>
        )}
      </div>

      {liveStats && <LiveStatsCard stats={liveStats} />}

      <div className="card events-card">
        <div className="card-title">Live Events</div>
        {events.length === 0 ? (
          <p className="empty-state">No events yet — waiting for game...</p>
        ) : (
          <EventFeed events={events} maxDisplay={30} className="events-list" />
        )}
      </div>
    </>
  )
}

export function MainWindow(): JSX.Element {
  const [view, setView] = useState<NavView>('dashboard')
  const [events, setEvents] = useState<GameEvent[]>([])
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [apiConnected, setApiConnected] = useState(false)

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => {
      setApiConnected(!!s.anthropicApiKey)
    })
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onNavigateTo) return
    const cleanup = window.electronAPI.onNavigateTo((navView) => {
      if (navView === 'settings') setView('settings')
    })
    return cleanup
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onEventsUpdate) return
    return window.electronAPI.onEventsUpdate((u) => setEvents(u.events))
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onLiveStatsUpdate) return
    return window.electronAPI.onLiveStatsUpdate((u) => setLiveStats(u.stats))
  }, [])

  function handleSettingsSaved(settings: AppSettings): void {
    setApiConnected(!!settings.anthropicApiKey)
  }

  const contentMeta: Record<NavView, { title: string; desc: string }> = {
    dashboard: { title: 'Dashboard', desc: 'Real-time coaching and game stats' },
    settings: { title: 'Settings', desc: 'Configure your AI coach' }
  }

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-layout">
        <Sidebar view={view} onNavigate={setView} apiConnected={apiConnected} />
        <div className="app-content">
          <div className="content-header">
            <span className="content-header-icon">
              {view === 'dashboard' ? '◈' : '◎'}
            </span>
            <div>
              <div className="content-header-title">{contentMeta[view].title}</div>
              <div className="content-header-desc">{contentMeta[view].desc}</div>
            </div>
          </div>
          <div className="content-body">
            {view === 'dashboard' ? (
              <DashboardView events={events} liveStats={liveStats} />
            ) : (
              <Settings onSaved={handleSettingsSaved} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

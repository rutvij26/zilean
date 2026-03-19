import React, { useEffect, useRef, useState } from 'react'
import {
  AppSettings,
  CoachingGoals,
  CoachingStatus,
  GameEvent,
  ItemSuggestion,
  BackTiming,
  LiveStats
} from '../../../shared/types'
import { EventFeed } from './components/EventFeed'
import './styles/overlay.css'

interface OverlayState {
  goals: CoachingGoals | null
  status: CoachingStatus
  isRefreshing: boolean
  lastError: string | null
  champion: string | null
  gameMode: string | null
}

const GAME_MODE_LABELS: Record<string, string> = {
  CLASSIC: 'SR',
  ARAM: 'ARAM',
  URF: 'URF',
  ARURF: 'URF',
  CHERRY: 'Arena',
  NEXUSBLITZ: 'Nexus Blitz',
  PRACTICETOOL: 'Practice',
  TUTORIAL_MODULE_1: 'Tutorial',
  TUTORIAL_MODULE_2: 'Tutorial',
  TUTORIAL_MODULE_3: 'Tutorial'
}

function formatGameMode(mode: string): string {
  return GAME_MODE_LABELS[mode] ?? mode
}

interface CollapsedState {
  personal: boolean
  team: boolean
  item: boolean
  back: boolean
}

function SectionHeader({
  label,
  tag,
  collapsed,
  onToggle
}: {
  label: string
  tag: string
  collapsed: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <div className="section-header" onClick={onToggle}>
      <span className="goals-label">{label}</span>
      <span className="section-tag">{tag}</span>
      <span className="section-chevron">{collapsed ? '▸' : '▾'}</span>
    </div>
  )
}

function ItemContent({ item }: { item: ItemSuggestion }): JSX.Element {
  return (
    <div className="item-section">
      <div>
        <span className="item-name">{item.name}</span>
        <span className="item-reason"> — {item.reason}</span>
      </div>
      <div className="item-gold-pill">⬡ {item.goldNeeded}g needed</div>
    </div>
  )
}

function BackContent({ backTiming }: { backTiming: BackTiming }): JSX.Element {
  return (
    <div className="back-section">
      <div className="back-suggestion">{backTiming.suggestion}</div>
      <div className="back-gold-pill">⬡ {backTiming.goldTarget}g target</div>
    </div>
  )
}

function LiveStatsRow({ stats }: { stats: LiveStats }): JSX.Element {
  return (
    <div className="live-stats-row">
      <span className="stat-item">KDA {stats.kdaRatio.toFixed(1)}</span>
      <span className="stat-sep">·</span>
      <span className="stat-item">CS/m {stats.csPerMin.toFixed(1)}</span>
      <span className="stat-sep">·</span>
      <span className="stat-item">KP {stats.killParticipation}%</span>
      <span className="stat-sep">·</span>
      <span className="stat-item">G/m {stats.goldPerMin}</span>
    </div>
  )
}

export function Overlay(): JSX.Element {
  const [state, setState] = useState<OverlayState>({
    goals: null,
    status: 'waiting',
    isRefreshing: false,
    lastError: null,
    champion: null,
    gameMode: null
  })

  const [events, setEvents] = useState<GameEvent[]>([])
  const [eventsCollapsed, setEventsCollapsed] = useState(true)
  const [bodyCollapsed, setBodyCollapsed] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const [collapsed, setCollapsed] = useState<CollapsedState>({
    personal: true,
    team: true,
    item: true,
    back: true
  })

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => setSettings(s))
  }, [])

  useEffect(() => {
    if (!cardRef.current || !window.electronAPI?.resizeOverlay) return
    const ro = new ResizeObserver(() => {
      if (!cardRef.current) return
      window.electronAPI?.resizeOverlay(cardRef.current.offsetHeight)
    })
    ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onCoachingUpdate) return

    const cleanup = window.electronAPI.onCoachingUpdate((update) => {
      setState((prev) => {
        if (update.status === 'waiting') {
          return {
            goals: null,
            status: 'waiting',
            isRefreshing: false,
            lastError: null,
            champion: null,
            gameMode: null
          }
        }

        const champion = update.champion ?? prev.champion
        const gameMode = update.gameMode ?? prev.gameMode

        if (update.status === 'error') {
          const errMsg = update.error?.includes('ANTHROPIC_API_KEY')
            ? 'No API key — open Settings (Alt+,)'
            : 'Last update failed'
          return {
            goals: update.goals ?? prev.goals,
            status: 'error',
            isRefreshing: false,
            lastError: errMsg,
            champion,
            gameMode
          }
        }

        const goals = update.goals ?? prev.goals
        return { goals, status: 'active', isRefreshing: true, lastError: null, champion, gameMode }
      })

      if (update.status === 'active') {
        setTimeout(() => {
          setState((prev) => ({ ...prev, isRefreshing: false }))
        }, 900)
      }
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onEventsUpdate) return
    const cleanup = window.electronAPI.onEventsUpdate((update) => {
      setEvents(update.events)
    })
    return cleanup
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onLiveStatsUpdate) return
    const cleanup = window.electronAPI.onLiveStatsUpdate((update) => {
      setLiveStats(update.stats)
    })
    return cleanup
  }, [])

  const toggle = (key: keyof CollapsedState): void =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  const { goals, status, isRefreshing, lastError, champion, gameMode } = state

  const showLiveStats = settings?.showLiveStats !== false
  const showEventFeed = settings?.showEventFeed !== false
  const showMatchupTip = settings?.showMatchupTip !== false

  const dragHandleStyle = {
    WebkitAppRegion: 'drag',
    cursor: 'grab',
    height: '6px',
    background: 'rgba(255,255,255,0.12)',
    borderRadius: '3px',
    margin: '2px 8px 0',
    flexShrink: 0
  } as React.CSSProperties

  const handleDragEnter = (): void => {
    window.electronAPI?.overlay?.setIgnoreMouseEvents(false)
  }

  const handleDragLeave = (): void => {
    window.electronAPI?.overlay?.setIgnoreMouseEvents(true)
  }

  if (status === 'waiting') {
    return (
      <div ref={cardRef} className="overlay-card">
        <div
          style={dragHandleStyle}
          onMouseEnter={handleDragEnter}
          onMouseLeave={handleDragLeave}
        />
        <div
          className="overlay-header overlay-header--clickable"
          onClick={() => setBodyCollapsed((v) => !v)}
        >
          <span>⚔ Zilean</span>
          <span className="header-chevron">{bodyCollapsed ? '▸' : '▾'}</span>
        </div>
        {!bodyCollapsed && <div className="overlay-waiting">Waiting for game...</div>}
      </div>
    )
  }

  const headerTitle = champion
    ? `${champion}${gameMode ? ` | ${formatGameMode(gameMode)}` : ''}`
    : '⚔ Zilean'

  return (
    <div ref={cardRef} className={`overlay-card${isRefreshing ? ' refreshing' : ''}`}>
      <div
        style={dragHandleStyle}
        onMouseEnter={handleDragEnter}
        onMouseLeave={handleDragLeave}
      />
      <div
        className="overlay-header overlay-header--clickable"
        onClick={() => setBodyCollapsed((v) => !v)}
      >
        <span>{headerTitle}</span>
        <div className="overlay-header-right">
          {goals && <span className="phase-badge">{goals.gamePhase}</span>}
          {goals && <span className="updated-at">{goals.updatedAt}</span>}
          {status === 'error' && <span className="error-badge">● Update failed</span>}
          <span className="header-chevron">{bodyCollapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!bodyCollapsed && (
        <>
          {showLiveStats && liveStats && (
            <>
              <LiveStatsRow stats={liveStats} />
              <hr className="overlay-divider" />
            </>
          )}

          {goals && (
            <>
              {showMatchupTip && goals.matchupTip && (
                <>
                  <div className="matchup-tip">{goals.matchupTip}</div>
                  <hr className="overlay-divider" />
                </>
              )}

              <div className="goals-section">
                <SectionHeader
                  label="Personal"
                  tag={goals.personalTag}
                  collapsed={collapsed.personal}
                  onToggle={() => toggle('personal')}
                />
                {!collapsed.personal &&
                  goals.personalGoals.map((g, i) => (
                    <div key={i} className="goal-item">
                      {g}
                    </div>
                  ))}
              </div>

              <hr className="overlay-divider" />

              <div className="goals-section">
                <SectionHeader
                  label="Team"
                  tag={goals.teamTag}
                  collapsed={collapsed.team}
                  onToggle={() => toggle('team')}
                />
                {!collapsed.team &&
                  goals.teamGoals.map((g, i) => (
                    <div key={i} className="goal-item">
                      {g}
                    </div>
                  ))}
              </div>

              {goals.item && (
                <>
                  <hr className="overlay-divider" />
                  <div className="goals-section">
                    <SectionHeader
                      label="Next Item"
                      tag={goals.item.name}
                      collapsed={collapsed.item}
                      onToggle={() => toggle('item')}
                    />
                    {!collapsed.item && <ItemContent item={goals.item} />}
                  </div>
                </>
              )}

              {goals.backTiming && (
                <>
                  <hr className="overlay-divider" />
                  <div className="goals-section">
                    <SectionHeader
                      label="Back Timing"
                      tag={`${goals.backTiming.goldTarget}g`}
                      collapsed={collapsed.back}
                      onToggle={() => toggle('back')}
                    />
                    {!collapsed.back && <BackContent backTiming={goals.backTiming} />}
                  </div>
                </>
              )}

              {lastError && (
                <>
                  <hr className="overlay-divider" />
                  <div className="overlay-footer">
                    <span className="error-badge">{lastError}</span>
                  </div>
                </>
              )}
            </>
          )}

          {showEventFeed && events.length > 0 && (
            <>
              <hr className="overlay-divider" />
              <div className="goals-section">
                <div
                  className="section-header"
                  onClick={() => setEventsCollapsed((v) => !v)}
                >
                  <span className="goals-label">Events</span>
                  <span className="section-chevron">{eventsCollapsed ? '▸' : '▾'}</span>
                </div>
                {!eventsCollapsed && <EventFeed events={events} maxDisplay={5} />}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { CoachingGoals, CoachingStatus } from '../../../shared/types'
import './styles/overlay.css'

interface OverlayState {
  goals: CoachingGoals | null
  status: CoachingStatus
  isRefreshing: boolean
  lastError: string | null
}

export function Overlay(): JSX.Element {
  const [state, setState] = useState<OverlayState>({
    goals: null,
    status: 'waiting',
    isRefreshing: false,
    lastError: null
  })

  useEffect(() => {
    if (!window.electronAPI?.onCoachingUpdate) return

    const cleanup = window.electronAPI.onCoachingUpdate((update) => {
      setState((prev) => {
        if (update.status === 'waiting') {
          return { goals: null, status: 'waiting', isRefreshing: false, lastError: null }
        }

        if (update.status === 'error') {
          const errMsg = update.error?.includes('ANTHROPIC_API_KEY')
            ? 'No API key — open Settings (Alt+,)'
            : 'Last update failed'
          return {
            goals: update.goals ?? prev.goals,
            status: 'error',
            isRefreshing: false,
            lastError: errMsg
          }
        }

        // active: flash refresh then settle
        const goals = update.goals ?? prev.goals
        return { goals, status: 'active', isRefreshing: true, lastError: null }
      })

      // Clear refreshing flag after animation
      if (update.status === 'active') {
        setTimeout(() => {
          setState((prev) => ({ ...prev, isRefreshing: false }))
        }, 900)
      }
    })

    return cleanup
  }, [])

  const { goals, status, isRefreshing, lastError } = state

  if (status === 'waiting') {
    return (
      <div className="overlay-card">
        <div className="overlay-header">Zilean</div>
        <div className="overlay-waiting">Waiting for game...</div>
      </div>
    )
  }

  return (
    <div className={`overlay-card${isRefreshing ? ' refreshing' : ''}`}>
      <div className="overlay-header">
        <span>Zilean</span>
        {status === 'error' && <span className="error-badge">● Update failed</span>}
      </div>

      {goals && (
        <>
          <div className="goals-section">
            <div className="goals-label">Personal</div>
            {goals.personalGoals.map((g, i) => (
              <div key={i} className="goal-item">▸ {g}</div>
            ))}
          </div>
          <div className="goals-section">
            <div className="goals-label">Team</div>
            {goals.teamGoals.map((g, i) => (
              <div key={i} className="goal-item">▸ {g}</div>
            ))}
          </div>
          <div className="overlay-footer">
            <span className="phase-badge">{goals.gamePhase}</span>
            <span className="updated-at">{goals.updatedAt}</span>
            {lastError && <span className="error-badge">{lastError}</span>}
          </div>
        </>
      )}
    </div>
  )
}

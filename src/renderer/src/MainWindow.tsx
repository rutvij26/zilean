import React from 'react'
import './styles/main.css'

export function MainWindow(): JSX.Element {
  return (
    <div className="main-window">
      <div className="main-header">
        <h1>Zilean</h1>
        <p className="subtitle">Real-time LoL AI Coach</p>
      </div>

      <div className="main-status">
        <div className="status-item">
          <span className="status-label">Status</span>
          <span className="status-value">Running</span>
        </div>
        <div className="status-item">
          <span className="status-label">Overlay</span>
          <span className="status-value">Alt+C to toggle</span>
        </div>
        <div className="status-item">
          <span className="status-label">Settings</span>
          <span className="status-value">Alt+, to open</span>
        </div>
      </div>

      <div className="main-v2-placeholder">
        <p>V2 — Historical Analysis</p>
        <button disabled className="btn-disabled">Analyze My Games</button>
        <p className="placeholder-note">Coming soon</p>
      </div>
    </div>
  )
}

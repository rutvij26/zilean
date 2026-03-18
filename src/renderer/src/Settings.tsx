import React, { useEffect, useState } from 'react'
import { AppSettings } from '../../../shared/types'
import './styles/main.css'

export function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>({
    anthropicApiKey: '',
    overlayVisible: true,
    summonerName: ''
  })
  const [saved, setSaved] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => {
      setSettings(s)
      // Show last 4 chars masked
      if (s.anthropicApiKey) {
        setApiKeyInput('••••••••' + s.anthropicApiKey.slice(-4))
      }
    })
  }, [])

  function handleSave(): void {
    const updated: AppSettings = {
      ...settings,
      // Only update key if user typed something new (not the masked placeholder)
      anthropicApiKey: apiKeyInput.startsWith('••••')
        ? settings.anthropicApiKey
        : apiKeyInput
    }
    window.electronAPI?.saveSettings(updated).then(() => {
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="settings-window">
      <h2>Settings</h2>

      <div className="settings-group">
        <label>Anthropic API Key</label>
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="sk-ant-..."
          className="settings-input"
        />
      </div>

      <div className="settings-group">
        <label>
          <input
            type="checkbox"
            checked={settings.overlayVisible}
            onChange={(e) => setSettings({ ...settings, overlayVisible: e.target.checked })}
          />
          {' '}Show overlay
        </label>
      </div>

      {settings.summonerName && (
        <div className="settings-group">
          <label>Detected Summoner</label>
          <span className="settings-value">{settings.summonerName}</span>
        </div>
      )}

      <div className="settings-group settings-v2-placeholder">
        <label className="label-disabled">Riot API Key (V2)</label>
        <input type="password" disabled placeholder="Not required for V1" className="settings-input" />
        <label className="label-disabled">Region (V2)</label>
        <input type="text" disabled placeholder="na1" className="settings-input" />
      </div>

      <div className="settings-actions">
        <button onClick={handleSave} className="btn-save">
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  )
}

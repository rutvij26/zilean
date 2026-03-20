import React, { useEffect, useState } from 'react'
import { AppSettings } from '../../../shared/types'
import './styles/main.css'

const CLAUDE_MODEL_OPTIONS = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    desc: 'Lightning-fast',
    cost: '~$0.04/game',
    badge: '⚡'
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    desc: 'Best quality',
    cost: '~$0.16/game',
    badge: '★'
  },
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    desc: 'Maximum depth',
    cost: '~$0.79/game',
    badge: '💎'
  }
]

const PERPLEXITY_MODEL_OPTIONS = [
  {
    id: 'sonar',
    label: 'Sonar',
    desc: 'Fast, cheap',
    cost: '~$0.02/game',
    badge: '⚡'
  },
  {
    id: 'sonar-pro',
    label: 'Sonar Pro',
    desc: 'Best quality',
    cost: '~$0.10/game',
    badge: '★'
  },
  {
    id: 'sonar-reasoning',
    label: 'Sonar Reasoning',
    desc: 'Chain-of-thought',
    cost: '~$0.20/game',
    badge: '🧠'
  }
]

const INTERVAL_OPTIONS = [
  { value: 60, label: 'Every 60s' },
  { value: 90, label: 'Every 90s' },
  { value: 120, label: 'Every 2 min' },
  { value: 180, label: 'Every 3 min' },
  { value: 300, label: 'Every 5 min' }
]

function maskKey(key: string): string {
  return key ? '••••••••' + key.slice(-4) : ''
}

const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  overlayVisible: true,
  summonerName: '',
  overlayTheme: 'lol-native',
  aiProvider: 'claude',
  aiModel: 'claude-sonnet-4-6',
  perplexityApiKey: '',
  perplexityModel: 'sonar',
  coachingIntervalSecs: 90,
  eventCoachingEnabled: true,
  eventCoachingSensitivity: 'major',
  showLiveStats: true,
  showEventFeed: true,
  showMatchupTip: true,
  autoUpdate: true
}

export function Settings({ onSaved }: { onSaved?: (settings: AppSettings) => void } = {}): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [perplexityKeyInput, setPerplexityKeyInput] = useState('')

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
      if (s.anthropicApiKey) {
        setApiKeyInput('••••••••' + s.anthropicApiKey.slice(-4))
      }
      if (s.perplexityApiKey) {
        setPerplexityKeyInput('••••••••' + s.perplexityApiKey.slice(-4))
      }
    })
  }, [])

  function handleSave(): void {
    const updated: AppSettings = {
      ...settings,
      anthropicApiKey: apiKeyInput === maskKey(settings.anthropicApiKey)
        ? settings.anthropicApiKey
        : apiKeyInput,
      perplexityApiKey: perplexityKeyInput === maskKey(settings.perplexityApiKey)
        ? settings.perplexityApiKey
        : perplexityKeyInput
    }
    window.electronAPI?.saveSettings(updated).then(() => {
      setSettings(updated)
      onSaved?.(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const isPerplexity = settings.aiProvider === 'perplexity'

  return (
    <div className="settings-page">

      <div className="settings-group">
        <label>AI Provider</label>
        <div className="model-picker">
          <label className={`model-option${!isPerplexity ? ' model-option--selected' : ''}`}>
            <input
              type="radio"
              name="aiProvider"
              value="claude"
              checked={!isPerplexity}
              onChange={() => {
                setSettings({ ...settings, aiProvider: 'claude' })
                setPerplexityKeyInput(maskKey(settings.perplexityApiKey))
              }}
            />
            <span className="model-label">Claude (Anthropic)</span>
            <span className="model-desc">Sonnet · Haiku · Opus</span>
          </label>
          <label className={`model-option${isPerplexity ? ' model-option--selected' : ''}`}>
            <input
              type="radio"
              name="aiProvider"
              value="perplexity"
              checked={isPerplexity}
              onChange={() => {
                setSettings({ ...settings, aiProvider: 'perplexity' })
                setApiKeyInput(maskKey(settings.anthropicApiKey))
              }}
            />
            <span className="model-label">Perplexity</span>
            <span className="model-desc">Sonar · Pro · Reasoning</span>
          </label>
        </div>
      </div>

      {!isPerplexity ? (
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
      ) : (
        <div className="settings-group">
          <label>Perplexity API Key</label>
          <input
            type="password"
            value={perplexityKeyInput}
            onChange={(e) => setPerplexityKeyInput(e.target.value)}
            placeholder="pplx-..."
            className="settings-input"
          />
        </div>
      )}

      {!isPerplexity ? (
        <div className="settings-group">
          <label>AI Model</label>
          <div className="model-picker">
            {CLAUDE_MODEL_OPTIONS.map((m) => (
              <label
                key={m.id}
                className={`model-option${settings.aiModel === m.id ? ' model-option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="aiModel"
                  value={m.id}
                  checked={settings.aiModel === m.id}
                  onChange={() => setSettings({ ...settings, aiModel: m.id })}
                />
                <span className="model-badge">{m.badge}</span>
                <span className="model-label">{m.label}</span>
                <span className="model-desc">{m.desc}</span>
                <span className="model-cost">{m.cost}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="settings-group">
          <label>AI Model</label>
          <div className="model-picker">
            {PERPLEXITY_MODEL_OPTIONS.map((m) => (
              <label
                key={m.id}
                className={`model-option${settings.perplexityModel === m.id ? ' model-option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="perplexityModel"
                  value={m.id}
                  checked={settings.perplexityModel === m.id}
                  onChange={() => setSettings({ ...settings, perplexityModel: m.id })}
                />
                <span className="model-badge">{m.badge}</span>
                <span className="model-label">{m.label}</span>
                <span className="model-desc">{m.desc}</span>
                <span className="model-cost">{m.cost}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="settings-group">
        <label>Coaching Frequency</label>
        <div className="interval-picker">
          {INTERVAL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`interval-option${settings.coachingIntervalSecs === opt.value ? ' interval-option--selected' : ''}`}
            >
              <input
                type="radio"
                name="coachingInterval"
                value={opt.value}
                checked={settings.coachingIntervalSecs === opt.value}
                onChange={() => setSettings({ ...settings, coachingIntervalSecs: opt.value })}
              />
              <span className="interval-option-label">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <label>Event Coaching</label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.eventCoachingEnabled}
            onChange={(e) => setSettings({ ...settings, eventCoachingEnabled: e.target.checked })}
          />
          {' '}Enable instant coaching on major events (Baron, Dragon, Inhib)
        </label>
        {settings.eventCoachingEnabled && (
          <label className="settings-checkbox settings-checkbox--indent">
            <input
              type="checkbox"
              checked={settings.eventCoachingSensitivity === 'all'}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  eventCoachingSensitivity: e.target.checked ? 'all' : 'major'
                })
              }
            />
            {' '}Also trigger on kills (uses more credits)
          </label>
        )}
      </div>

      <div className="settings-group">
        <label>Features</label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.showLiveStats}
            onChange={(e) => setSettings({ ...settings, showLiveStats: e.target.checked })}
          />
          {' '}Show live stats
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.showEventFeed}
            onChange={(e) => setSettings({ ...settings, showEventFeed: e.target.checked })}
          />
          {' '}Show event feed
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.showMatchupTip}
            onChange={(e) => setSettings({ ...settings, showMatchupTip: e.target.checked })}
          />
          {' '}Show matchup tip
        </label>
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

      <div className="settings-group">
        <label>Updates</label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.autoUpdate ?? true}
            onChange={(e) => setSettings({ ...settings, autoUpdate: e.target.checked })}
          />
          {' '}Automatically download and install updates
        </label>
      </div>

      {settings.summonerName && (
        <div className="settings-group">
          <label>Detected Summoner</label>
          <span className="settings-value">{settings.summonerName}</span>
        </div>
      )}

      <div className="settings-group">
        <label>Overlay Theme</label>
        <select
          value={settings.overlayTheme}
          onChange={(e) =>
            setSettings({ ...settings, overlayTheme: e.target.value as AppSettings['overlayTheme'] })
          }
          className="settings-input"
        >
          <option value="lol-native">LoL Native Dark</option>
          <option value="minimal" disabled>Minimal Pills (coming soon)</option>
          <option value="sidebar" disabled>Sidebar (coming soon)</option>
        </select>
      </div>

      <div className="settings-actions">
        <button onClick={handleSave} className="btn-save">
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  )
}

# Zilean — LoL AI Coach

## Stack
- Electron + electron-vite, React, TypeScript
- Vitest (TDD — all tests in `tests/`)
- Claude `claude-sonnet-4-6` via `@anthropic-ai/sdk`
- pgvector/postgres (V2, `docker compose up -d`)

## Commands
```bash
npm run dev         # Start app (Electron + Vite HMR)
npm test            # Run all tests
npm run typecheck   # TypeScript check
docker compose up -d  # Start postgres (V2)
```

## Folder Map
```
electron/main/
  index.ts    # Electron app, windows, IPC, tray, hotkeys
  poller.ts   # Riot Live Client API polling (60s interval)
  coach.ts    # Claude coaching engine
  settings.ts # User settings persistence
electron/preload/
  index.ts    # contextBridge IPC exposure
src/renderer/src/
  App.tsx       # Routes to Overlay/Settings/MainWindow
  Overlay.tsx   # Transparent game overlay
  Settings.tsx  # Settings window
  MainWindow.tsx # Main status window
shared/
  types.ts    # Shared TypeScript interfaces
tests/
  poller.test.ts, coach.test.ts
  integration/gameLoop.test.ts
```

## Key Patterns
- Immutable state — never mutate GameState/CoachingGoals
- Smart poll: Claude called only on meaningful game change or 3-min fallback
- Error resilience: keep last goals + show error badge on Claude failure
- `rejectUnauthorized: false` for Riot's self-signed TLS cert

## Phase Status → see `.claude/milestones.md`

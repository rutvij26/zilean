# Zilean — Milestones

## V1 — Core Overlay ✅ COMPLETE

- [x] electron-vite scaffold + windows + hotkeys + tray
- [x] Riot Live Client poller (TDD)
- [x] Claude coaching engine (TDD)
- [x] Overlay UI (TDD)
- [x] Wired loop + integration tests
- [x] Settings + Docker scaffold + config files
- [x] Event feed — fast polling (5s) + overlay + main window reactive event stream
- [x] Local API reference doc + Swagger capture utility
- [x] Items, abilities, runes, summoner spells, lane opponent, matchup tip coaching

## P1 — Cost Optimization + Live Stats Engine ✅ COMPLETE

- [x] User-configurable AI model (Haiku 4.5 / Sonnet 4.6 / Opus 4.6) with $/game estimates in Settings
- [x] Configurable coaching interval (60s / 90s / 2min / 3min / 5min)
- [x] Event coaching sensitivity toggle (major events only vs. all kills)
- [x] State fingerprinting — skip Claude when game state unchanged (~15 calls/30-min game)
- [x] 22 computed live stats (CS/min, KDA, KP%, gold/min, ward score, dragon control, etc.)
- [x] Overlay compact stats row (KDA · CS/m · KP · G/m)
- [x] MainWindow full LiveStats card (22-stat grid with phase tag + streak badge)
- [x] Prompt compression ~40% fewer tokens (compact team context, removed backTiming, MAX_TOKENS 700)
- [x] Per-feature toggles (showLiveStats, showEventFeed, showMatchupTip)
- [x] Discord-like main window (980×720, resizable, sidebar nav, integrated Settings, no menu bar)
- [x] 144 tests passing (liveStats: 38, poller: 48, events: 19, coach: 21, gameLoop: 7, EventFeed: 11)

## Release Pipeline — Pre-V3 Prerequisite ✅ COMPLETE

- [x] Update the minimize maximize and close bar on top of electron app to match the theme and should look seamless like discord.
- [x] Add `electron-builder` devDependency + build config in `package.json`
- [x] Configure GitHub Releases publish provider (uses `GH_TOKEN` env var)
- [x] Set up `electron-updater` auto-update in `electron/main/index.ts`
- [x] Add build scripts: `npm run build:win` (package), `npm run dist` (publish to GitHub)
- [x] Update tray with "Check for Updates" option
- [x] Document release flow in README
- [x] Skip code signing for open beta (SmartScreen warning expected, documented)
- [x] Output: Windows NSIS installer `.exe` + portable `.exe`

## V2 — In-Game Enhancement (no external API required)

### V2a — Timers + Awareness

- [ ] Objective spawn timers — baron (20 min), rift herald (8 min), dragon (5 min), camps — calculated from game time
- [ ] Dragon/Baron buff tracker — show remaining duration from event timestamp
- [ ] Ability level-up hint — "which ability to level next" added to coaching output
- [ ] Dead time tracker — "you've been dead Xs this game" from ChampionKill events

### V2b — Champion Select Coach (main window only)

- [ ] Detect champion select state
- [ ] Ban/pick recommendations in MainWindow during champion selection
- [ ] Rune recommendations based on matchup
- [ ] Does NOT appear in overlay — overlay only activates during live game

### V2c — Historical Analysis + AI Macro Coach

- [ ] DB schema + pgvector setup
- [ ] Post-game stat collection (save GameState snapshot on game end)
- [ ] AI Macro Coach — after 10 games, identify "Top 3 things to improve"
- [ ] MainWindow "My Games" — per-game stats history

### V2d — Draggable Overlay

- [ ] Drag handle on overlay (`-webkit-app-region: drag` CSS)
- [ ] IPC to toggle `setIgnoreMouseEvents` on mouse enter/leave drag handle
- [ ] Save overlay position to settings (`overlayX`, `overlayY`) — persist across sessions
- [ ] Restore overlay position on startup

## V3 — Community Data Integration (static data, no Riot API key)

- [ ] Data Dragon champion stats — matchup power spikes at each level
- [ ] Meta tier lists via community static endpoints
- [ ] Better item build recommendations with current-patch win-rate context
- [ ] Manual enemy summoner spell timer (user clicks in overlay to start countdown)

## V4 — Riot API (requires user's Riot API key in Settings)

- [ ] Lobby scouting — show enemy playstyle patterns from match history
- [ ] Rank comparison analytics — compare stats vs same-rank players
- [ ] Incremental match-V5 sync on startup

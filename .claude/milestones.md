# Zilean — Milestones

## V1 — Core Overlay
- [x] P1: electron-vite scaffold + windows + hotkeys + tray
- [x] P2: Riot Live Client poller (TDD)
- [x] P3: Claude coaching engine (TDD)
- [x] P4: Overlay UI (TDD)
- [x] P5: Wired loop + integration tests
- [x] P6: Settings + Docker scaffold + config files

## V2 — Historical Analysis + RAG
- [ ] Riot Match-V5 fetcher (history.ts)
- [ ] Per-game analyzer — extract stats + generate summary (analyzer.ts)
- [ ] pgvector DB wired — embed + store summaries
- [ ] Intelligent similarity search — archetype/role/game-phase aware (rag.ts)
- [ ] RAG context injected into Claude prompt
- [ ] Repeat mistake detection + toast alerts
- [ ] Main window "Analyze My Games" UI
- [ ] Incremental analysis (only fetch new games)

## V3 — Distribution
- [ ] electron-builder NSIS installer (.exe)
- [ ] Auto-start with Windows
- [ ] Detect LoL process start → auto-activate overlay
- [ ] Auto-fetch new games on app startup (opt-in)
- [ ] Auto-updater

## V4 — Advanced (TBD)
- [ ] Post-game report card (graded, improvement areas)
- [ ] Multi-account support
- [ ] Custom coaching focus (e.g. "focus on macro only")

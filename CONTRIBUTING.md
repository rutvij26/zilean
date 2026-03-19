# Contributing to Zilean

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- Node.js 20+
- League of Legends installed locally (or use mock game data for testing)
- An Anthropic API key for testing AI coaching features

## Setup

```bash
git clone https://github.com/rutvij26/zilean.git
cd zilean
npm install
npm run dev
```

For V2 features (historical stats, pgvector):
```bash
docker compose up -d
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure `npm test` and `npm run typecheck` both pass
4. Open a pull request

## Branch Naming

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Maintenance, deps, config |
| `perf/` | Performance improvements |

Examples: `feat/kill-streak-alerts`, `fix/overlay-flicker`, `docs/api-key-setup`

## Commit Format

Zilean uses [Conventional Commits](https://www.conventionalcommits.org/). This drives automated semantic versioning:

```
<type>: <short description>

<optional body>
```

| Type | Release triggered |
|------|------------------|
| `feat` | Minor (1.x.0) |
| `fix`, `perf` | Patch (1.0.x) |
| `docs`, `chore`, `refactor` | No release |
| `feat!` or `BREAKING CHANGE` | Major (x.0.0) |

Examples:
```
feat: show kill streak bonus tips on overlay
fix: prevent overlay from stealing focus during champion select
perf: debounce Claude calls on rapid stat changes
```

## Code Style

- **Immutable state** — never mutate `GameState` or `CoachingGoals` in place; return new objects
- **Small files** — aim for 200–400 lines; 800 is the hard cap
- **Small functions** — under 50 lines
- **No deep nesting** — max 4 levels
- **Explicit error handling** — no silent catches
- **No hardcoded values** — use constants or config

## PR Checklist

Before submitting:
- [ ] `npm test` passes (all tests green)
- [ ] `npm run typecheck` passes (no TS errors)
- [ ] New behaviour has test coverage
- [ ] Commit messages follow Conventional Commits

## Questions / Contact

Open a GitHub Discussion, or email **contact@rutvijsathe.dev**.

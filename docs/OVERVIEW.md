# SimpleFi — Implementation Overview

## Status: Planning complete, ready to build

Full spec: `HANDOFF.md` | Conventions: `CLAUDE.md` | Design: `.github/copilot-instructions.md`

## Phase Roadmap

| Phase                                                   | Goal                                          | Key output                  |
| ------------------------------------------------------- | --------------------------------------------- | --------------------------- |
| [1 — Data Layer](./phase-1-data-layer.md)               | Go + SQLite, schema migrations, model methods | `go test ./...` passes      |
| [2 — HTTP API](./phase-2-http-api.md)                   | 3 endpoints live on `:8080`, CORS enabled     | curl-testable API           |
| [3 — Frontend Scaffold](./phase-3-frontend-scaffold.md) | Vite + SolidJS + Tailwind, live data flowing  | Dark theme + JSON on screen |
| [4 — UI Components](./phase-4-ui-components.md)         | All 4 components, fully interactive           | Complete working app        |
| [5 — PWA + Polish](./phase-5-pwa-polish.md)             | Installable, offline-ready, production build  | Lighthouse PWA green        |

## Dependency Chain

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Each phase gate: verify the listed test steps before moving to the next.

## Quick Reference

```bash
# Backend (Phase 1-2)
cd backend && go run .          # dev server on :8080
cd backend && go test ./...     # run tests

# Frontend (Phase 3-5)
cd frontend && npm run dev      # Vite dev on :5173
cd frontend && npm run build    # production build to dist/
```

## SQLite Driver Decision

Using `modernc.org/sqlite` (pure Go, no CGO/gcc required on Windows).
Driver name: `"sqlite"` — not `"sqlite3"`.

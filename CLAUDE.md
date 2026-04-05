# SimpleFi — Project Guide

## What Is This?

A "dead simple" PWA financial tracker. Single-screen UI, zero-friction expense entry. Dark mode, Fino-inspired aesthetic.

## Tech Stack

| Layer    | Tech                               | Why                                      |
| -------- | ---------------------------------- | ---------------------------------------- |
| Frontend | SolidJS + Vite + Tailwind CSS      | Zero VDOM, reactive signals, fast builds |
| Backend  | Go 1.22+ (std lib router) + SQLite | Fast, single-binary, zero-dep deploy     |
| PWA      | vite-plugin-pwa                    | Offline-capable, installable             |

## Directory Structure

```
simple-fi/
├── CLAUDE.md
├── docs/
│   └── HANDOFF.md              # Full product spec & design decisions
│
├── backend/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                 # Server bootstrap, CORS middleware, router
│   ├── handler/
│   │   └── transaction.go      # HTTP handlers (GET/POST /api/transactions, GET /api/statistics)
│   ├── model/
│   │   └── transaction.go      # Transaction struct + DB methods (queries, inserts)
│   ├── store/
│   │   └── sqlite.go           # SQLite connection init, migrations, pool
│   └── data.db                 # SQLite file (gitignored)
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    ├── public/
    │   ├── manifest.webmanifest
    │   ├── icon-192.png
    │   └── icon-512.png
    └── src/
        ├── index.tsx            # SolidJS mount
        ├── index.css            # Tailwind directives
        ├── App.tsx              # Main hub — signals, resources, layout
        ├── components/
        │   ├── BalanceHeader.tsx
        │   ├── TransactionSheet.tsx
        │   ├── StatBars.tsx
        │   └── RecentList.tsx
        └── lib/
            └── api.ts           # Fetch wrappers for backend endpoints
```

### Backend structure rationale

- **`handler/`** — HTTP handlers only. Parse request, call model, write response. No business logic.
- **`model/`** — Data types + DB operations. One file per domain entity.
- **`store/`** — DB connection lifecycle. Schema migrations go here.
- No `internal/`, `pkg/`, `service/`, or `repository/` layers — this app is small. Add them only when a second domain entity appears and complexity demands it.

### Frontend structure rationale

- **`components/`** — UI components. Flat, no nesting. Name = what it renders.
- **`lib/`** — Non-UI code (API calls, helpers). Keep thin.
- No `hooks/`, `stores/`, `utils/`, `types/`, or `context/` folders — SolidJS signals live in `App.tsx` and pass down as props. Extract only when reuse is proven.

## Coding Conventions

### Go (Backend)

- **Go 1.22+ router**: Use `http.HandleFunc("GET /api/path", handler)` pattern. No third-party routers.
- **Error handling**: Return errors up, handle at the handler level with appropriate HTTP status codes.
- **Naming**: Files are singular (`transaction.go` not `transactions.go`). Handlers use `HandleX` prefix.
- **JSON**: Use `encoding/json`. Struct tags with `json:"snake_case"`.
- **No ORM**: Write raw SQL. SQLite queries stay in `model/`.
- **No global state**: Pass dependencies (DB) via closure or struct receiver.

### SolidJS (Frontend)

- **Signals over stores**: Use `createSignal` and `createResource` in `App.tsx`. Pass via props. No global store libraries.
- **Components are functions**: `export default function ComponentName(props) { ... }`. No classes.
- **Reactive primitives**: Use `<Show>`, `<For>`, `<Switch>`/`<Match>` — never ternaries in JSX for conditional rendering.
- **Styling**: Tailwind utility classes. No CSS modules, no styled-components.
- **No `useEffect` equivalent abuse**: Use `createEffect` sparingly and only for side effects (not derived data — use `createMemo` instead).
- **TypeScript**: Strict mode. Define prop types inline or with `type` (not `interface`).

### General

- No `.env` files in git. Use `.env.local` for local overrides.
- API base URL: Configurable via Vite env var `VITE_API_URL`, defaults to `http://localhost:8080`.
- All API routes prefixed with `/api/`.

## Commands

```bash
# Backend
cd backend && go run .                    # Start dev server on :8080
cd backend && go test ./...               # Run all tests

# Frontend
cd frontend && npm install                # Install deps
cd frontend && npm run dev                # Vite dev server on :5173
cd frontend && npm run build              # Production build to dist/
```

## Key Design Decisions

1. **Single-screen architecture** — No router. State-driven overlays (bottom sheets) replace page navigation.
2. **Server-side aggregation** — Statistics computed in SQL, not JS. The `/api/statistics` endpoint returns pre-calculated percentages.
3. **CSS-only data viz** — Percentage bars via `width: ${pct}%` on divs. No charting libraries.
4. **PWA-first** — `display: standalone`, auto-updating service worker, full offline install support.
5. **Theme** — Dark background `#120F1C`, neon accents (purple-500, blue-400, pink-500), high-contrast white text.

<p align="center">
  <img src="frontend/public/banner.png" alt="SimpleFi — Track simply. Live freely." width="720">
</p>

# SimpleFi

A dead-simple, installable PWA financial tracker. One screen, zero friction, light and dark themes.

Log expenses in seconds — tap the FAB, enter the amount, pick a category, done. No sign-up forms with email verification, no multi-page flows, no feature bloat.

## Architecture

```
┌──────────────────────────────────────────────┐
│                   Browser / PWA              │
│  SolidJS + Vite + Tailwind + TanStack Query  │
└──────────────────┬───────────────────────────┘
                   │ JSON over HTTP
┌──────────────────▼───────────────────────────┐
│              Go HTTP Server                  │
│  stdlib router · JWT auth · static files     │
│                    │                         │
│               ┌────▼────┐                    │
│               │ SQLite  │                    │
│               └─────────┘                    │
└──────────────────────────────────────────────┘
```

Single binary. Single database file. No external services.

| Layer    | Tech                          | Why                                      |
| -------- | ----------------------------- | ---------------------------------------- |
| Frontend | SolidJS + Vite + Tailwind CSS | Zero VDOM, reactive signals, fast builds |
| Backend  | Go 1.22+ (stdlib router)      | Fast, single-binary, zero-dep deploy     |
| Database | SQLite (pure Go driver)       | Embedded, zero config, no server needed  |
| PWA      | vite-plugin-pwa               | Offline-capable, installable on mobile   |
| Charts   | µPlot                         | 45KB, canvas-based, no React overhead    |

## Features

### Money in, money out

- **Single-screen UI** — balance, recent transactions, and quick-add all on one page
- **Bottom sheet entry** — tap the FAB, enter amount, pick category, submit. Three taps max
- **Full CRUD** — edit and delete any transaction, not just create
- **Transfers** — move money between accounts
- **Filters** — narrow the transaction list by type, category, account, and date range
- **Swipe gestures** — swipe a transaction row to reveal edit/delete

### Accounts & categories

- **Multiple accounts** — Cash, Bank, Credit, E-Wallet with per-account balances
- **Private accounts** — mark an account private so it stays out of shared views and the combined balance
- **Managed categories** — emoji-icon categories, add/edit/delete, seeded with defaults

### Automation

- **Recurring rules** — auto-log rent, subscriptions, and salary on a daily/weekly/monthly/yearly schedule, with an optional end date
- **Confirm or skip** — due recurring transactions surface for one-tap confirm or skip instead of silently posting

### Planning & insight

- **Budgets** — monthly, yearly, or custom-range spending limits, scoped to all accounts or one, with per-category sub-limits and live progress
- **Analytics** — category and account spending breakdowns across four periods (30 days, this month, YTD, last year)
- **Trend chart** — spending over time via µPlot
- **CSV export** — download your transactions from the server

### Sharing

- **Partnerships** — share a ledger as a **couple** (2 members) or a **group** (unlimited)
- **Invitations** — invite by username, with pending/sent invitation lists and accept/decline
- **Context switcher** — flip between your personal ledger and each shared one
- **Per-member filtering** — see who spent what inside a shared context

### Platform

- **User auth** — username/password login with bcrypt + JWT, passphrase-based password recovery (no email required)
- **PWA installable** — works offline, add to home screen, standalone app feel
- **Auto-update** — the service worker polls for new builds and prompts to reload
- **Theming** — light, dark, or follow-system, with no flash of wrong theme on load
- **Edge-to-edge** — `viewport-fit=cover` with safe-area insets for notched phones

## Project Structure

```
simple-fi/
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── main.go                  # Server, SPA handler, CORS, health check, .env loader
│   ├── auth/
│   │   ├── jwt.go               # HS256 JWT (stdlib only)
│   │   └── middleware.go        # RequireAuth middleware
│   ├── handler/
│   │   ├── auth.go              # Register, login, reset password
│   │   ├── transaction.go       # Transactions, statistics, analytics, export
│   │   ├── account.go           # Account CRUD + privacy
│   │   ├── category.go          # Category CRUD
│   │   ├── budget.go            # Budget CRUD + progress
│   │   ├── recurring.go         # Recurring rule CRUD
│   │   └── partnership.go       # Partnerships + invitations
│   ├── model/                   # Queries + domain types (one file per entity, *_test.go alongside)
│   └── store/
│       └── sqlite.go            # DB init, migrations
│
└── frontend/
    ├── vite.config.ts
    ├── index.html
    ├── public/                  # logo.png, banner.png, icon-192/512.png, manifest
    └── src/
        ├── App.tsx              # Auth gating, navigation state
        ├── lib/
        │   ├── api.ts           # Typed fetch wrappers
        │   ├── theme.ts         # light/dark/system
        │   ├── sw-update.ts     # Service worker update prompt
        │   ├── swipe.ts         # Swipe-to-reveal gesture
        │   ├── scroll-lock.ts   # Body scroll lock for sheets
        │   └── media.ts         # Breakpoint signal
        └── components/          # BalanceHeader, TransactionSheet, RecentList, StatBars,
                                 # TrendChart, TransactionFilters, BudgetSheet, BudgetView,
                                 # RecurringList, PartnershipView, InviteModal,
                                 # ContextSwitcher, AccountStrip, SidebarMenu, ...
```

## Run Locally

**Prerequisites:** Go 1.22+, Node.js 18+

```bash
# 1. Start the backend (port 8080)
cd backend
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env   # else tokens die on every restart
go run .

# 2. In another terminal, start the frontend (port 5173)
cd frontend
npm install       # or: pnpm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend calls `VITE_API_URL`, defaulting to `http://localhost:8080`.

> Using pnpm? `frontend/pnpm-workspace.yaml` pre-approves the `esbuild` and `sharp` build scripts that pnpm 10+ blocks by default. Keep it committed.

### Environment Variables

| Variable     | Default          | Description                                        |
| ------------ | ---------------- | -------------------------------------------------- |
| `JWT_SECRET` | auto-generated   | HMAC key for signing JWTs. **Set it** — otherwise a new one is generated per boot and everyone is logged out |
| `DB_PATH`    | `data.db`        | Path to the SQLite database file (parent dirs auto-created) |
| `PORT`       | `8080`           | Server listen port                                 |
| `STATIC_DIR` | _(unset in dev)_ | Path to built frontend assets; unset = API only    |

The backend loads `backend/.env` on startup. Real environment variables win over file values.

### Tests

```bash
cd backend && go test ./...     # model + auth unit tests
cd frontend && npx tsc --noEmit # typecheck
```

## Deploy

### Docker Compose (recommended for Coolify)

```bash
docker compose up -d --build
```

`docker-compose.yml` builds from the local `Dockerfile`, persists SQLite in a named volume, and reads two Coolify-managed variables:

| Variable                       | What Coolify does with it                                          |
| ------------------------------ | ------------------------------------------------------------------ |
| `SERVICE_FQDN_SIMPLEFI_8080`   | Generates the public domain and wires the proxy to port 8080        |
| `SERVICE_PASSWORD_JWT`         | Generates a random secret **once** and reuses it on every redeploy  |

Using `SERVICE_PASSWORD_JWT` is the point: it removes the footgun where a redeploy rotates `JWT_SECRET` and logs everyone out.

**Coolify steps**

1. Connect the repo, choose **Docker Compose** as the build pack
2. Point it at `docker-compose.yml`
3. Deploy — the domain, secret, and `/app/data` volume are all declared in the file

Running plain `docker compose up` outside Coolify? Uncomment the `ports:` block and set `JWT_SECRET` yourself in a `.env` next to the compose file.

### Plain Docker

```bash
docker build -t simplefi .
docker run -d \
  -p 8080:8080 \
  -v simplefi-data:/app/data \
  -e JWT_SECRET=your-secret-here \
  simplefi
```

The image is a multi-stage build (~30MB final):

1. **Node** — builds the frontend with Vite
2. **Go** — compiles the backend to a static binary (`CGO_ENABLED=0`)
3. **Alpine** — runs the binary and serves the frontend as static files

`GET /api/health` is the container health check.

## API Endpoints

All endpoints are prefixed with `/api/`. Auth and health routes are public; everything else requires a `Bearer` token.

### Public

| Method | Path                       | Description                   |
| ------ | -------------------------- | ----------------------------- |
| GET    | `/api/health`              | Health check                  |
| GET    | `/api/version`             | Build version                 |
| POST   | `/api/auth/register`       | Create account                |
| POST   | `/api/auth/login`          | Get JWT token                 |
| POST   | `/api/auth/reset-password` | Reset password via passphrase |

### Transactions

| Method | Path                             | Description                       |
| ------ | -------------------------------- | --------------------------------- |
| GET    | `/api/transactions`              | List (supports filter params)     |
| POST   | `/api/transactions`              | Create                            |
| PUT    | `/api/transactions/{id}`         | Update                            |
| DELETE | `/api/transactions/{id}`         | Delete                            |
| POST   | `/api/transactions/{id}/confirm` | Confirm a due recurring instance  |
| POST   | `/api/transactions/{id}/skip`    | Skip a due recurring instance     |
| GET    | `/api/transactions/export`       | CSV export                        |
| GET    | `/api/statistics`                | Category stats by month           |
| GET    | `/api/analytics`                 | Breakdown by period (`?period=`)  |
| GET    | `/api/analytics/trend`           | Time-series points for the chart  |

### Accounts, categories, budgets, recurring

| Method | Path                              | Description             |
| ------ | --------------------------------- | ----------------------- |
| GET    | `/api/accounts`                   | List accounts           |
| POST   | `/api/accounts`                   | Create account          |
| PUT    | `/api/accounts/{id}`              | Update account          |
| DELETE | `/api/accounts/{id}`              | Delete account          |
| PATCH  | `/api/accounts/{id}/privacy`      | Toggle account privacy  |
| GET    | `/api/categories`                 | List categories         |
| POST   | `/api/categories`                 | Create category         |
| PUT    | `/api/categories/{id}`            | Update category         |
| DELETE | `/api/categories/{id}`            | Delete category         |
| GET    | `/api/budgets`                    | List budgets + progress |
| POST   | `/api/budgets`                    | Create budget           |
| PUT    | `/api/budgets/{id}`               | Update budget           |
| DELETE | `/api/budgets/{id}`               | Delete budget           |
| GET    | `/api/recurring-rules`            | List recurring rules    |
| POST   | `/api/recurring-rules`            | Create recurring rule   |
| PUT    | `/api/recurring-rules/{id}`       | Update recurring rule   |
| DELETE | `/api/recurring-rules/{id}`       | Delete recurring rule   |

### Sharing

| Method | Path                              | Description                    |
| ------ | --------------------------------- | ------------------------------ |
| GET    | `/api/me`                         | Current user info              |
| GET    | `/api/partnerships`               | List partnerships              |
| POST   | `/api/partnerships`               | Create couple or group         |
| GET    | `/api/partnerships/{id}`          | Partnership detail + members   |
| POST   | `/api/partnerships/{id}/invite`   | Invite a user by username      |
| POST   | `/api/partnerships/{id}/leave`    | Leave a partnership            |
| GET    | `/api/invitations`                | Invitations received           |
| GET    | `/api/invitations/sent`           | Invitations sent               |
| POST   | `/api/invitations/{id}/respond`   | Accept or decline              |

## Future Improvements

- **Multi-currency** — support currencies beyond PHP
- **Notifications** — PWA push notifications for budget alerts
- **Biometric lock** — fingerprint/face unlock when installed as PWA
- **Backup/restore** — export and import the SQLite database
- **CSV import** — bring in history from another tracker
- **Attachments** — snap a receipt photo onto a transaction
- **Recurring budgets** — roll a budget forward automatically each period

# SimpleFi

A dead-simple, installable PWA financial tracker. One screen, zero friction, dark mode.

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

## Features

- **Single-screen UI** — balance, recent transactions, and quick-add all on one page
- **Bottom sheet entry** — tap the FAB, enter amount, pick category, submit. Three taps max
- **Multiple accounts** — Cash, Bank, Credit, E-Wallet with per-account balances
- **Transfers** — move money between accounts
- **Managed categories** — emoji-icon categories, add/edit/delete, seeded with defaults
- **Analytics** — category and account spending breakdowns across 4 time periods (30 days, this month, YTD, last year)
- **User auth** — username/password login with JWT, passphrase-based password recovery
- **PWA installable** — works offline, add to home screen, standalone app feel
- **Dark mode** — Fino-inspired aesthetic with neon purple/blue/pink accents

## Project Structure

```
simple-fi/
├── Dockerfile
├── .dockerignore
├── backend/
│   ├── main.go                  # Server, SPA handler, CORS, health check
│   ├── auth/
│   │   ├── jwt.go               # HS256 JWT (stdlib only)
│   │   └── middleware.go        # RequireAuth middleware
│   ├── handler/
│   │   ├── auth.go              # Register, login, reset password
│   │   ├── transaction.go       # Transactions + statistics + analytics
│   │   ├── account.go           # Account CRUD
│   │   └── category.go          # Category CRUD
│   ├── model/
│   │   ├── transaction.go       # Transaction queries, analytics
│   │   ├── account.go           # Account queries
│   │   ├── category.go          # Category queries
│   │   └── user.go              # User auth, bcrypt, passphrase
│   └── store/
│       └── sqlite.go            # DB init, migrations
│
└── frontend/
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx              # Auth gating, navigation state
        ├── lib/
        │   ├── api.ts           # Typed fetch wrappers
        │   └── cn.ts            # clsx + tailwind-merge
        └── components/
            ├── BalanceHeader.tsx
            ├── TransactionSheet.tsx
            ├── RecentList.tsx
            ├── StatBars.tsx
            ├── AccountStrip.tsx
            ├── AccountModal.tsx
            ├── ManageAccountsModal.tsx
            ├── ManageCategoriesModal.tsx
            ├── SidebarMenu.tsx
            ├── LoginScreen.tsx
            └── PassphraseModal.tsx
```

## Run Locally

**Prerequisites:** Go 1.22+, Node.js 18+

```bash
# 1. Start the backend (port 8080)
cd backend
go run .

# 2. In another terminal, start the frontend (port 5173)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies API calls to `:8080` via the `VITE_API_URL` env var (set automatically in `.env.development`).

### Environment Variables

| Variable     | Default          | Description                      |
| ------------ | ---------------- | -------------------------------- |
| `JWT_SECRET` | auto-generated   | HMAC key for signing JWTs        |
| `DB_PATH`    | `data.db`        | Path to the SQLite database file |
| `PORT`       | `8080`           | Server listen port               |
| `STATIC_DIR` | _(unset in dev)_ | Path to built frontend assets    |

## Deploy with Docker

```bash
# Build the image
docker build -t simplefi .

# Run with persistent data
docker run -d \
  -p 8080:8080 \
  -v simplefi-data:/app/data \
  -e JWT_SECRET=your-secret-here \
  simplefi
```

The image is a multi-stage build (~30MB final):

1. **Node** — builds the frontend with Vite
2. **Go** — compiles the backend to a static binary
3. **Alpine** — runs the binary, serves the frontend as static files

### Deploy on Coolify

1. Connect your repo in Coolify and select **Dockerfile** as the build pack
2. Under **Network**, set the port to `8080`
3. Add a **persistent volume** with destination `/app/data`
4. Set `JWT_SECRET` in **Environment Variables** (important — without this, a new secret is generated on each redeploy and all users get logged out)
5. Deploy

The container exposes a health check at `GET /api/health` which Coolify uses to verify the app is running.

## API Endpoints

All endpoints are prefixed with `/api/`. Auth routes are public; everything else requires a `Bearer` token.

| Method | Path                       | Auth | Description                   |
| ------ | -------------------------- | ---- | ----------------------------- |
| GET    | `/api/health`              | No   | Health check                  |
| POST   | `/api/auth/register`       | No   | Create account                |
| POST   | `/api/auth/login`          | No   | Get JWT token                 |
| POST   | `/api/auth/reset-password` | No   | Reset password via passphrase |
| GET    | `/api/me`                  | Yes  | Current user info             |
| GET    | `/api/transactions`        | Yes  | List transactions             |
| POST   | `/api/transactions`        | Yes  | Create transaction            |
| GET    | `/api/statistics`          | Yes  | Category stats by month       |
| GET    | `/api/analytics`           | Yes  | Spending breakdown by period  |
| GET    | `/api/accounts`            | Yes  | List accounts                 |
| POST   | `/api/accounts`            | Yes  | Create account                |
| PUT    | `/api/accounts/{id}`       | Yes  | Update account                |
| DELETE | `/api/accounts/{id}`       | Yes  | Delete account                |
| GET    | `/api/categories`          | Yes  | List categories               |
| POST   | `/api/categories`          | Yes  | Create category               |
| PUT    | `/api/categories/{id}`     | Yes  | Update category               |
| DELETE | `/api/categories/{id}`     | Yes  | Delete category               |

## Future Improvements

- **Recurring transactions** — auto-log rent, subscriptions, salary on a schedule
- **Budget goals** — set monthly limits per category with progress tracking
- **Data export** — download transactions as CSV
- **Multi-currency** — support currencies beyond PHP
- **Charts** — optional line/pie charts for trends over time (keep CSS bars as default)
- **Shared accounts** — invite others to a shared ledger
- **Notifications** — PWA push notifications for budget alerts
- **Biometric lock** — fingerprint/face unlock when installed as PWA
- **Backup/restore** — export and import the SQLite database
- **Edge-to-edge PWA** — `viewport-fit=cover` with `env(safe-area-inset-*)` for modern phones

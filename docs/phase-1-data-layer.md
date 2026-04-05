# Phase 1: Backend Data Layer (Go + SQLite)

## Goal

Go project boots, connects to SQLite, runs migrations, and has working model methods. No HTTP yet — just the data foundation.

## Files to Create

| File | Purpose |
|------|---------|
| `backend/go.mod` | Module declaration, Go 1.22+ |
| `backend/store/sqlite.go` | `New(path) (*sql.DB, error)`: opens SQLite, enables WAL mode, runs CREATE TABLE/INDEX, configures pool |
| `backend/model/transaction.go` | `Transaction` struct with JSON tags; `List(db)`, `Create(db, tx)`, `Statistics(db, month)` methods |
| `backend/model/transaction_test.go` | Tests using in-memory SQLite (`:memory:`) |

## Implementation Details

### SQLite Driver

Use `modernc.org/sqlite` (pure Go, no CGO/gcc needed on Windows).

- Import: `_ "modernc.org/sqlite"`
- Open: `sql.Open("sqlite", path)`
- Driver name is `"sqlite"`, not `"sqlite3"`

### `store/sqlite.go`

- Accept a file path, open the connection
- Enable WAL journal mode: `PRAGMA journal_mode=WAL`
- Set `busy_timeout` pragma
- Run schema migrations:

```sql
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
```

- Return `*sql.DB` — no global variable

### `model/transaction.go`

**Transaction struct**:
- `ID` string `json:"id"` — UUID generated on insert
- `Amount` float64 `json:"amount"`
- `Type` string `json:"type"` — "income" or "expense"
- `Category` string `json:"category"` — defaults to "General"
- `Description` string `json:"description"` — optional
- `CreatedAt` time.Time `json:"created_at"`

**Methods** (all accept `*sql.DB` as first param):
- `List(db)` — `SELECT * FROM transactions ORDER BY created_at DESC`
- `Create(db, tx)` — generates UUID (`google/uuid`), inserts row, returns full object
- `Statistics(db, month)` — queries `SELECT category, SUM(amount) FROM transactions WHERE type='expense' AND strftime('%Y-%m', created_at) = ? GROUP BY category`, computes percentage of total in Go

**CategoryStat struct**:
- `Category` string `json:"category"`
- `Amount` float64 `json:"amount"`
- `Percentage` float64 `json:"percentage"`

## Verify

```bash
cd backend && go build ./...    # Compiles cleanly
cd backend && go test ./...     # All tests pass
```

**Test coverage** (`model/transaction_test.go`):
1. Open in-memory SQLite via `store.New(":memory:")`
2. `Create` two transactions (one income, one expense)
3. `List` returns 2 results in descending chronological order
4. `Statistics` returns correct percentage math for the expense

## Gotchas

- SQLite `strftime('%Y-%m', created_at)` requires ISO 8601 format. Use `time.Now().UTC().Format(time.RFC3339)` for programmatic inserts.
- The `id` column is TEXT (UUID), not auto-increment INTEGER.
- `modernc.org/sqlite` driver name is `"sqlite"` — using `"sqlite3"` will fail.

# Phase 2: Backend API (HTTP Handlers + CORS)

**Depends on**: Phase 1 (data layer must compile and pass tests)

## Goal

Running HTTP server on `:8080` with all 3 API endpoints responding correctly. Testable with curl.

## Files to Create

| File | Purpose |
|------|---------|
| `backend/main.go` | Server bootstrap: `store.New("data.db")`, route registration, CORS middleware, `ListenAndServe(":8080")` |
| `backend/handler/transaction.go` | `HandleListTransactions(db)`, `HandleCreateTransaction(db)`, `HandleGetStatistics(db)` — each returns `http.HandlerFunc` |

## Implementation Details

### `main.go`

```
1. db := store.New("data.db")    // defer db.Close()
2. mux := http.NewServeMux()
3. Register routes (Go 1.22 method-pattern syntax):
   - mux.HandleFunc("GET /api/transactions", handler.HandleListTransactions(db))
   - mux.HandleFunc("POST /api/transactions", handler.HandleCreateTransaction(db))
   - mux.HandleFunc("GET /api/statistics", handler.HandleGetStatistics(db))
4. Wrap mux with CORS middleware
5. log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
```

### Handler Pattern

Closure-based dependency injection (per CLAUDE.md — no global state):

```go
func HandleListTransactions(db *sql.DB) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // call model, marshal JSON, write response
    }
}
```

### `HandleListTransactions`

- Calls `model.List(db)`
- Important: if result is nil slice, initialize to `[]Transaction{}` so JSON serializes as `[]` not `null`
- Sets `Content-Type: application/json`

### `HandleCreateTransaction`

- Decodes JSON body into `model.Transaction`
- Validates: amount > 0, type is "income" or "expense"
- Returns 400 on validation failure with error message
- Calls `model.Create(db, tx)`
- Returns 201 Created with the created object

### `HandleGetStatistics`

- Reads `month` from `r.URL.Query().Get("month")`
- If missing, defaults to current month: `time.Now().Format("2006-01")`
- Calls `model.Statistics(db, month)`
- Marshals and writes JSON

### CORS Middleware

Simple function wrapping `http.Handler`:
- Sets headers: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`
- Handles `OPTIONS` method with 204 No Content and early return
- For all other methods, calls `next.ServeHTTP(w, r)`

## Verify

```bash
# Start server
cd backend && go run .

# Empty list
curl http://localhost:8080/api/transactions
# → []

# Create a transaction
curl -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount":25.50,"type":"expense","category":"Food","description":"Lunch"}'
# → 201 + object with generated id and created_at

# Create a few more with different categories, then:
curl http://localhost:8080/api/transactions
# → Array in reverse chronological order

# Statistics
curl "http://localhost:8080/api/statistics?month=2026-04"
# → Category breakdown with percentages summing to ~100

# CORS preflight
curl -X OPTIONS http://localhost:8080/api/transactions \
  -H "Origin: http://localhost:5173" -i
# → Access-Control-Allow-* headers present
```

## Gotchas

- Go 1.22's method-pattern routing is method-sensitive. `POST` to a `GET`-registered route returns 405 automatically. Register `GET` and `POST` as separate handlers for `/api/transactions`.
- CORS middleware must return early after handling OPTIONS — don't forget to `return` before calling `next.ServeHTTP`.
- JSON `null` vs `[]`: always initialize empty slices before marshaling.

package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"strings"

	"simple-fi/auth"
	"simple-fi/handler"
	"simple-fi/store"
)

func main() {
	loadEnv(".env")

	db, err := store.New("data.db")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	jwtSecret := auth.LoadOrGenerateSecret()

	mux := http.NewServeMux()

	// Public auth routes
	mux.HandleFunc("POST /api/auth/register", handler.HandleRegister(db, jwtSecret))
	mux.HandleFunc("POST /api/auth/login", handler.HandleLogin(db, jwtSecret))
	mux.HandleFunc("POST /api/auth/reset-password", handler.HandleResetPassword(db))

	// Protected routes
	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/transactions", handler.HandleListTransactions(db))
	protected.HandleFunc("POST /api/transactions", handler.HandleCreateTransaction(db))
	protected.HandleFunc("GET /api/statistics", handler.HandleGetStatistics(db))
	protected.HandleFunc("GET /api/analytics", handler.HandleGetAnalytics(db))
	protected.HandleFunc("GET /api/accounts", handler.HandleListAccounts(db))
	protected.HandleFunc("POST /api/accounts", handler.HandleCreateAccount(db))
	protected.HandleFunc("PUT /api/accounts/{id}", handler.HandleUpdateAccount(db))
	protected.HandleFunc("DELETE /api/accounts/{id}", handler.HandleDeleteAccount(db))
	protected.HandleFunc("GET /api/categories", handler.HandleListCategories(db))
	protected.HandleFunc("POST /api/categories", handler.HandleCreateCategory(db))
	protected.HandleFunc("PUT /api/categories/{id}", handler.HandleUpdateCategory(db))
	protected.HandleFunc("DELETE /api/categories/{id}", handler.HandleDeleteCategory(db))
	protected.HandleFunc("GET /api/me", handler.HandleGetMe(db))
	mux.Handle("/api/", auth.RequireAuth(jwtSecret, protected))

	log.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loadEnv reads KEY=VALUE pairs from a file and sets them as env vars.
// Existing env vars are not overwritten. Silently skips if file doesn't exist.
func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // file absent — fine
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		// Strip optional surrounding quotes
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

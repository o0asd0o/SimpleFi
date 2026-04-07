package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"simple-fi/auth"
	"simple-fi/handler"
	"simple-fi/store"
)

func main() {
	loadEnv(".env")

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data.db"
	}
	if dir := filepath.Dir(dbPath); dir != "." {
		os.MkdirAll(dir, 0755)
	}
	db, err := store.New(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	jwtSecret := auth.LoadOrGenerateSecret()

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("POST /api/auth/register", handler.HandleRegister(db, jwtSecret))
	mux.HandleFunc("POST /api/auth/login", handler.HandleLogin(db, jwtSecret))
	mux.HandleFunc("POST /api/auth/reset-password", handler.HandleResetPassword(db))

	// Protected routes
	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/transactions", handler.HandleListTransactions(db))
	protected.HandleFunc("POST /api/transactions", handler.HandleCreateTransaction(db))
	protected.HandleFunc("DELETE /api/transactions/{id}", handler.HandleDeleteTransaction(db))
	protected.HandleFunc("PUT /api/transactions/{id}", handler.HandleUpdateTransaction(db))
	protected.HandleFunc("POST /api/transactions/{id}/confirm", handler.HandleConfirmTransaction(db))
	protected.HandleFunc("POST /api/transactions/{id}/skip", handler.HandleSkipTransaction(db))
	protected.HandleFunc("GET /api/statistics", handler.HandleGetStatistics(db))
	protected.HandleFunc("GET /api/analytics", handler.HandleGetAnalytics(db))
	protected.HandleFunc("GET /api/recurring-rules", handler.HandleListRecurringRules(db))
	protected.HandleFunc("POST /api/recurring-rules", handler.HandleCreateRecurringRule(db))
	protected.HandleFunc("PUT /api/recurring-rules/{id}", handler.HandleUpdateRecurringRule(db))
	protected.HandleFunc("DELETE /api/recurring-rules/{id}", handler.HandleDeleteRecurringRule(db))
	protected.HandleFunc("GET /api/accounts", handler.HandleListAccounts(db))
	protected.HandleFunc("POST /api/accounts", handler.HandleCreateAccount(db))
	protected.HandleFunc("PUT /api/accounts/{id}", handler.HandleUpdateAccount(db))
	protected.HandleFunc("DELETE /api/accounts/{id}", handler.HandleDeleteAccount(db))
	protected.HandleFunc("PATCH /api/accounts/{id}/privacy", handler.HandleSetAccountPrivacy(db))
	protected.HandleFunc("GET /api/categories", handler.HandleListCategories(db))
	protected.HandleFunc("POST /api/categories", handler.HandleCreateCategory(db))
	protected.HandleFunc("PUT /api/categories/{id}", handler.HandleUpdateCategory(db))
	protected.HandleFunc("DELETE /api/categories/{id}", handler.HandleDeleteCategory(db))
	protected.HandleFunc("GET /api/me", handler.HandleGetMe(db))
	protected.HandleFunc("GET /api/partnerships", handler.HandleListPartnerships(db))
	protected.HandleFunc("POST /api/partnerships", handler.HandleCreatePartnership(db))
	protected.HandleFunc("GET /api/partnerships/{id}", handler.HandleGetPartnership(db))
	protected.HandleFunc("POST /api/partnerships/{id}/leave", handler.HandleLeavePartnership(db))
	protected.HandleFunc("POST /api/partnerships/{id}/invite", handler.HandleInviteToPartnership(db))
	protected.HandleFunc("GET /api/invitations", handler.HandleListInvitations(db))
	protected.HandleFunc("GET /api/invitations/sent", handler.HandleListSentInvitations(db))
	protected.HandleFunc("POST /api/invitations/{id}/respond", handler.HandleRespondToInvitation(db))
	mux.Handle("/api/", auth.RequireAuth(jwtSecret, protected))

	// Serve frontend static files when STATIC_DIR is set
	if dir := os.Getenv("STATIC_DIR"); dir != "" {
		mux.Handle("/", spaHandler(dir))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
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

// spaHandler serves static files from dir, falling back to index.html for SPA routes.
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If the file exists on disk, serve it directly
		if _, err := os.Stat(filepath.Join(dir, r.URL.Path)); err == nil {
			fs.ServeHTTP(w, r)
			return
		}
		// SPA fallback: serve index.html for client-side routing
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
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

package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListTransactions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		txs, err := model.List(db, userID)
		if err != nil {
			http.Error(w, "failed to list transactions", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(txs)
	}
}

func HandleCreateTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tx model.Transaction
		if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if tx.Amount <= 0 {
			http.Error(w, "amount must be greater than 0", http.StatusBadRequest)
			return
		}
		if tx.Type != "income" && tx.Type != "expense" && tx.Type != "transfer" {
			http.Error(w, "type must be 'income', 'expense', or 'transfer'", http.StatusBadRequest)
			return
		}
		if tx.Type == "transfer" {
			if tx.AccountID == "" || tx.ToAccountID == "" {
				http.Error(w, "transfer requires account_id and to_account_id", http.StatusBadRequest)
				return
			}
			if tx.AccountID == tx.ToAccountID {
				http.Error(w, "cannot transfer to same account", http.StatusBadRequest)
				return
			}
		}

		userID := auth.UserIDFromContext(r.Context())
		created, err := model.Create(db, tx, userID)
		if err != nil {
			http.Error(w, "failed to create transaction", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

func HandleGetStatistics(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		month := r.URL.Query().Get("month")
		if month == "" {
			month = time.Now().Format("2006-01")
		}

		userID := auth.UserIDFromContext(r.Context())
		stats, err := model.Statistics(db, userID, month)
		if err != nil {
			http.Error(w, "failed to get statistics", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}
}

func HandleGetAnalytics(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		period := r.URL.Query().Get("period")
		if period == "" {
			period = "30d"
		}

		userID := auth.UserIDFromContext(r.Context())
		result, err := model.Analytics(db, userID, period)
		if err != nil {
			if errors.Is(err, model.ErrInvalidPeriod) {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			http.Error(w, "failed to get analytics", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

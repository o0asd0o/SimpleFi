package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListTransactions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		// Lazy-generate pending recurring transactions
		if err := model.GeneratePendingTransactions(db, userID); err != nil {
			log.Printf("warning: failed to generate recurring transactions: %v", err)
		}

		limit := 15
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
				limit = n
			}
		}
		cursor := r.URL.Query().Get("cursor")

		page, err := model.List(db, userID, limit, cursor)
		if err != nil {
			http.Error(w, "failed to list transactions", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(page)
	}
}

func HandleCreateTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			model.Transaction
			Recurring bool   `json:"recurring"`
			Frequency string `json:"frequency"`
			StartDate string `json:"start_date"`
			EndDate   string `json:"end_date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		tx := body.Transaction

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

		if body.Recurring {
			validFreqs := map[string]bool{"daily": true, "weekly": true, "biweekly": true, "monthly": true, "yearly": true}
			if !validFreqs[body.Frequency] {
				http.Error(w, "frequency must be daily, weekly, biweekly, monthly, or yearly", http.StatusBadRequest)
				return
			}
		}

		userID := auth.UserIDFromContext(r.Context())
		created, err := model.Create(db, tx, userID)
		if err != nil {
			http.Error(w, "failed to create transaction", http.StatusInternalServerError)
			return
		}

		// If marked as recurring, also create a recurring rule
		if body.Recurring && body.Frequency != "" {
			var nextDueStr string
			if body.StartDate != "" {
				// Use the user-specified start date as next_due
				if parsed, err := time.Parse("2006-01-02", body.StartDate); err == nil {
					nextDueStr = parsed.Format("2006-01-02")
				} else {
					// Fallback: advance from today
					nextDueStr = model.AdvanceDatePublic(time.Now().UTC(), body.Frequency).Format("2006-01-02")
				}
			} else {
				nextDueStr = model.AdvanceDatePublic(time.Now().UTC(), body.Frequency).Format("2006-01-02")
			}
			rule := model.RecurringRule{
				Amount:      tx.Amount,
				Type:        tx.Type,
				Category:    tx.Category,
				CategoryID:  tx.CategoryID,
				Description: tx.Description,
				AccountID:   tx.AccountID,
				ToAccountID: tx.ToAccountID,
				Frequency:   body.Frequency,
				NextDue:     nextDueStr,
				EndDate:     body.EndDate,
			}
			if createdRule, err := model.CreateRecurringRule(db, rule, userID); err != nil {
				log.Printf("warning: created transaction but failed to create recurring rule: %v", err)
			} else {
				// Link the transaction to the rule
				model.SetRecurringRuleID(db, created.ID, userID, createdRule.ID)
				created.RecurringRuleID = createdRule.ID
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

func HandleUpdateTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
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
		updated, err := model.Update(db, id, tx, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to update transaction", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
	}
}

func HandleDeleteTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())
		if err := model.Delete(db, id, userID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to delete transaction", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func HandleConfirmTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())

		// Get the transaction first to find its recurring_rule_id
		tx, err := model.GetTransaction(db, id, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to get transaction", http.StatusInternalServerError)
			return
		}

		if err := model.ConfirmTransaction(db, id, userID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				// Already confirmed — treat as success
				w.WriteHeader(http.StatusOK)
				return
			}
			http.Error(w, "failed to confirm transaction", http.StatusInternalServerError)
			return
		}

		// Advance the recurring rule's next_due
		if tx.RecurringRuleID != "" {
			if err := model.AdvanceNextDue(db, tx.RecurringRuleID, userID); err != nil {
				log.Printf("warning: confirmed transaction but failed to advance recurring rule: %v", err)
			}
		}

		w.WriteHeader(http.StatusOK)
	}
}

func HandleSkipTransaction(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())

		// Get the transaction first to find its recurring_rule_id
		tx, err := model.GetTransaction(db, id, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to get transaction", http.StatusInternalServerError)
			return
		}

		// Delete the pending transaction
		if err := model.Delete(db, id, userID); err != nil {
			http.Error(w, "failed to skip transaction", http.StatusInternalServerError)
			return
		}

		// Advance the recurring rule's next_due
		if tx.RecurringRuleID != "" {
			if err := model.AdvanceNextDue(db, tx.RecurringRuleID, userID); err != nil {
				log.Printf("warning: skipped transaction but failed to advance recurring rule: %v", err)
			}
		}

		w.WriteHeader(http.StatusNoContent)
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

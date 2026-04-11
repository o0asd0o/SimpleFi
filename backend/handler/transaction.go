package handler

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
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

		// Lazy-generate pending recurring transactions (always for the current user's own rules)
		if err := model.GeneratePendingTransactions(db, userID); err != nil {
			log.Printf("warning: failed to generate recurring transactions: %v", err)
		}

		partnershipID := r.URL.Query().Get("partnership_id")
		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		limit := 15
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
				limit = n
			}
		}
		cursor := r.URL.Query().Get("cursor")

		filters := model.ListFilters{
			AccountID:  r.URL.Query().Get("account_id"),
			CategoryID: r.URL.Query().Get("category_id"),
			SortDir:    r.URL.Query().Get("sort"),
			Type:       r.URL.Query().Get("type"),
		}

		page, err := model.List(db, allIDs, userID, limit, cursor, filters)
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

		// Validate write access to the account(s)
		if tx.AccountID != "" {
			ok, err := model.IsAccountWritableBy(db, tx.AccountID, userID)
			if err != nil {
				http.Error(w, "failed to validate account access", http.StatusInternalServerError)
				return
			}
			if !ok {
				http.Error(w, "account not accessible", http.StatusForbidden)
				return
			}
		}
		if tx.ToAccountID != "" {
			ok, err := model.IsAccountWritableBy(db, tx.ToAccountID, userID)
			if err != nil {
				http.Error(w, "failed to validate account access", http.StatusInternalServerError)
				return
			}
			if !ok {
				http.Error(w, "to_account not accessible", http.StatusForbidden)
				return
			}
		}

		// Determine if start_date is in the future (skip initial transaction entry)
		startIsFuture := false
		if body.Recurring && body.StartDate != "" {
			if parsed, err := time.Parse("2006-01-02", body.StartDate); err == nil {
				today := time.Now().UTC().Truncate(24 * time.Hour)
				startIsFuture = parsed.UTC().Truncate(24 * time.Hour).After(today)
			}
		}

		var created model.Transaction
		if !startIsFuture {
			var err error
			created, err = model.Create(db, tx, userID)
			if err != nil {
				http.Error(w, "failed to create transaction", http.StatusInternalServerError)
				return
			}
		}

		// If marked as recurring, also create a recurring rule
		if body.Recurring && body.Frequency != "" {
			var nextDueStr string
			if body.StartDate != "" {
				if parsed, err := time.Parse("2006-01-02", body.StartDate); err == nil {
					nextDueStr = parsed.Format("2006-01-02")
				} else {
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
			} else if !startIsFuture && created.ID != "" {
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

		allIDs, err := model.GetUnionVisibleAccountIDs(db, userID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}

		if err := model.Delete(db, id, allIDs, userID); err != nil {
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

		allIDs, err := model.GetUnionVisibleAccountIDs(db, userID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}

		// Validate access and get recurring_rule_id
		tx, err := model.GetTransaction(db, id, allIDs, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to get transaction", http.StatusInternalServerError)
			return
		}

		if err := model.ConfirmTransaction(db, id); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				// Already confirmed — treat as success
				w.WriteHeader(http.StatusOK)
				return
			}
			http.Error(w, "failed to confirm transaction", http.StatusInternalServerError)
			return
		}

		// Advance the recurring rule's next_due (rule is owned by whoever created the rule)
		if tx.RecurringRuleID != "" {
			if err := model.AdvanceNextDue(db, tx.RecurringRuleID); err != nil {
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

		allIDs, err := model.GetUnionVisibleAccountIDs(db, userID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}

		// Validate access and get recurring_rule_id
		tx, err := model.GetTransaction(db, id, allIDs, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "transaction not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to get transaction", http.StatusInternalServerError)
			return
		}

		// Delete the pending transaction
		if err := model.Delete(db, id, allIDs, userID); err != nil {
			http.Error(w, "failed to skip transaction", http.StatusInternalServerError)
			return
		}

		// Advance the recurring rule's next_due
		if tx.RecurringRuleID != "" {
			if err := model.AdvanceNextDue(db, tx.RecurringRuleID); err != nil {
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
		partnershipID := r.URL.Query().Get("partnership_id")
		filterUserID := r.URL.Query().Get("user_id")

		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		stats, err := model.Statistics(db, allIDs, userID, month, filterUserID)
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
		partnershipID := r.URL.Query().Get("partnership_id")
		filterUserID := r.URL.Query().Get("user_id")

		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		result, err := model.Analytics(db, allIDs, userID, period, filterUserID)
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

// HandleExportTransactions streams all transactions as a CSV file download.
func HandleExportTransactions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		partnershipID := r.URL.Query().Get("partnership_id")

		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		rows, err := model.ExportAll(db, allIDs, userID)
		if err != nil {
			http.Error(w, "failed to export transactions", http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("simplefi-transactions-%s.csv", time.Now().UTC().Format("2006-01-02"))
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)

		cw := csv.NewWriter(w)
		cw.Write([]string{"Date", "Type", "Category", "Description", "Amount", "Account", "To Account", "Status"})
		for _, row := range rows {
			cw.Write([]string{
				row.CreatedAt.Format("2006-01-02"),
				row.Type,
				row.Category,
				row.Description,
				fmt.Sprintf("%.2f", row.Amount),
				row.Account,
				row.ToAccount,
				row.Status,
			})
		}
		cw.Flush()
		if err := cw.Error(); err != nil {
			log.Printf("csv write error: %v", err)
		}
	}
}

// HandleGetAnalyticsTrend returns daily/weekly expense totals for charting.
func HandleGetAnalyticsTrend(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		period := r.URL.Query().Get("period")
		if period == "" {
			period = "30d"
		}

		userID := auth.UserIDFromContext(r.Context())
		partnershipID := r.URL.Query().Get("partnership_id")
		filterUserID := r.URL.Query().Get("user_id")

		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		points, err := model.AnalyticsTrend(db, allIDs, userID, period, filterUserID)
		if err != nil {
			if errors.Is(err, model.ErrInvalidPeriod) {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			http.Error(w, "failed to get analytics trend", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(points)
	}
}

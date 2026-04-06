package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListRecurringRules(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		rules, err := model.ListRecurringRules(db, userID)
		if err != nil {
			http.Error(w, "failed to list recurring rules", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rules)
	}
}

func HandleCreateRecurringRule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var rule model.RecurringRule
		if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if rule.Amount <= 0 {
			http.Error(w, "amount must be greater than 0", http.StatusBadRequest)
			return
		}
		if rule.Type != "income" && rule.Type != "expense" && rule.Type != "transfer" {
			http.Error(w, "type must be 'income', 'expense', or 'transfer'", http.StatusBadRequest)
			return
		}
		validFreqs := map[string]bool{"daily": true, "weekly": true, "biweekly": true, "monthly": true, "yearly": true}
		if !validFreqs[rule.Frequency] {
			http.Error(w, "frequency must be daily, weekly, biweekly, monthly, or yearly", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		created, err := model.CreateRecurringRule(db, rule, userID)
		if err != nil {
			http.Error(w, "failed to create recurring rule", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

func HandleUpdateRecurringRule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Frequency string `json:"frequency"`
			NextDue   string `json:"next_due"`
			EndDate   string `json:"end_date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		validFreqs := map[string]bool{"daily": true, "weekly": true, "biweekly": true, "monthly": true, "yearly": true}
		if !validFreqs[body.Frequency] {
			http.Error(w, "frequency must be daily, weekly, biweekly, monthly, or yearly", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		if err := model.UpdateRecurringRule(db, id, userID, body.Frequency, body.NextDue, body.EndDate); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "recurring rule not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to update recurring rule", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func HandleDeleteRecurringRule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())

		// Soft-deactivate the rule
		if err := model.DeleteRecurringRule(db, id, userID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "recurring rule not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to delete recurring rule", http.StatusInternalServerError)
			return
		}

		// Clean up any pending transactions for this rule
		if err := model.DeletePendingByRule(db, id, userID); err != nil {
			http.Error(w, "failed to clean up pending transactions", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

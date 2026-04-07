package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListAccounts(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		partnershipID := r.URL.Query().Get("partnership_id")
		accounts, err := model.ListAccounts(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to list accounts", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(accounts)
	}
}

func HandleCreateAccount(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name      string `json:"name"`
			Type      string `json:"type"`
			IsPrivate bool   `json:"is_private"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if body.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}
		validTypes := map[string]bool{"cash": true, "credit": true, "debit": true, "savings": true}
		if !validTypes[body.Type] {
			http.Error(w, "type must be 'cash', 'credit', 'debit', or 'savings'", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		a := model.Account{Name: body.Name, Type: body.Type, IsPrivate: body.IsPrivate}
		created, err := model.CreateAccount(db, a, userID)
		if err != nil {
			http.Error(w, "failed to create account", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

func HandleUpdateAccount(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Name string `json:"name"`
			Type string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if body.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}
		validTypes := map[string]bool{"cash": true, "credit": true, "debit": true, "savings": true}
		if !validTypes[body.Type] {
			http.Error(w, "type must be 'cash', 'credit', 'debit', or 'savings'", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		updated, err := model.UpdateAccount(db, id, body.Name, body.Type, userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "account not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to update account", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
	}
}

func HandleDeleteAccount(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())

		err := model.DeleteAccount(db, id, userID)
		if err != nil {
			if errors.Is(err, model.ErrAccountHasTransactions) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "account has transactions and cannot be deleted"})
				return
			}
			http.Error(w, "failed to delete account", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "account deleted"})
	}
}

func HandleSetAccountPrivacy(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			IsPrivate bool `json:"is_private"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		if err := model.SetAccountPrivacy(db, id, body.IsPrivate, userID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "account not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to update account privacy", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

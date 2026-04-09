package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListBudgets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		partnershipID := r.URL.Query().Get("partnership_id")

		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		budgets, err := model.ListBudgets(db, userID, allIDs)
		if err != nil {
			http.Error(w, "failed to list budgets", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(budgets)
	}
}

func HandleCreateBudget(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		var input model.BudgetInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := validateBudgetInput(input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		bp, err := model.CreateBudget(db, userID, input)
		if err != nil {
			http.Error(w, "failed to create budget", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(bp)
	}
}

func HandleUpdateBudget(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		var input model.BudgetInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := validateBudgetInput(input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		partnershipID := r.URL.Query().Get("partnership_id")
		own, partner, err := model.GetVisibleAccountIDs(db, userID, partnershipID)
		if err != nil {
			http.Error(w, "failed to resolve accounts", http.StatusInternalServerError)
			return
		}
		allIDs := append(own, partner...)

		bp, err := model.UpdateBudget(db, id, userID, input, allIDs)
		if errors.Is(err, model.ErrBudgetNotFound) {
			http.Error(w, "budget not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "failed to update budget", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(bp)
	}
}

func HandleDeleteBudget(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		err := model.DeleteBudget(db, id, userID)
		if errors.Is(err, model.ErrBudgetNotFound) {
			http.Error(w, "budget not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "failed to delete budget", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

var validPeriodTypes = map[string]bool{"month": true, "year": true, "custom": true}

func validateBudgetInput(input model.BudgetInput) error {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return errors.New("name is required")
	}
	if len(input.Name) > 100 {
		return errors.New("name must be 100 characters or fewer")
	}
	if input.Amount <= 0 {
		return errors.New("amount must be greater than 0")
	}
	if !validPeriodTypes[input.PeriodType] {
		return errors.New("period_type must be 'month', 'year', or 'custom'")
	}
	if input.PeriodType == "custom" {
		if input.StartDate == "" || input.EndDate == "" {
			return errors.New("start_date and end_date are required for custom period")
		}
		if input.EndDate <= input.StartDate {
			return errors.New("end_date must be after start_date")
		}
	}
	for _, cat := range input.Categories {
		if cat.CategoryID == "" {
			return errors.New("category_id is required for each category limit")
		}
		if cat.Amount <= 0 {
			return errors.New("category amount must be greater than 0")
		}
	}
	return nil
}

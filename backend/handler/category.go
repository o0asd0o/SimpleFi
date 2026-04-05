package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListCategories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		cats, err := model.ListCategoriesForUser(db, userID)
		if err != nil {
			http.Error(w, "failed to list categories", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cats)
	}
}

func HandleCreateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
			Icon string `json:"icon"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if body.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}
		if body.Icon == "" {
			http.Error(w, "icon is required", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		created, err := model.CreateCategory(db, body.Name, body.Icon, userID)
		if err != nil {
			http.Error(w, "failed to create category", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

func HandleUpdateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Name string `json:"name"`
			Icon string `json:"icon"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if body.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}
		if body.Icon == "" {
			http.Error(w, "icon is required", http.StatusBadRequest)
			return
		}

		updated, err := model.UpdateCategory(db, id, body.Name, body.Icon)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "category not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to update category", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
	}
}

func HandleDeleteCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())

		err := model.RemoveCategoryFromUser(db, id, userID)
		if err != nil {
			if errors.Is(err, model.ErrCategoryInUse) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "category is in use and cannot be removed"})
				return
			}
			http.Error(w, "failed to remove category", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "category removed"})
	}
}

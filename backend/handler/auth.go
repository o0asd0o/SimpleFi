package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleRegister(db *sql.DB, jwtSecret []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Name     string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		user, passphrase, err := model.Register(db, req.Username, req.Password, req.Name)
		if err != nil {
			if errors.Is(err, model.ErrUsernameTaken) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "username already taken"})
				return
			}
			if errors.Is(err, model.ErrValidation) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "registration failed"})
			return
		}

		token, err := auth.GenerateToken(user.ID, jwtSecret)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"user":       user,
			"token":      token,
			"passphrase": passphrase,
		})
	}
}

func HandleLogin(db *sql.DB, jwtSecret []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		user, err := model.Authenticate(db, req.Username, req.Password)
		if err != nil {
			if errors.Is(err, model.ErrInvalidCredentials) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "login failed"})
			return
		}

		token, err := auth.GenerateToken(user.ID, jwtSecret)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"user":  user,
			"token": token,
		})
	}
}

func HandleResetPassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username    string `json:"username"`
			Passphrase  string `json:"passphrase"`
			NewPassword string `json:"new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		err := model.ResetPassword(db, req.Username, req.Passphrase, req.NewPassword)
		if err != nil {
			if errors.Is(err, model.ErrInvalidPassphrase) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid passphrase"})
				return
			}
			if errors.Is(err, model.ErrValidation) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "password reset failed"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"message": "password updated"})
	}
}

func HandleGetMe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		user, err := model.GetUserByID(db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get user"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

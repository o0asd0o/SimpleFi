package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"simple-fi/auth"
	"simple-fi/model"
)

func HandleListPartnerships(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		partnerships, err := model.ListPartnerships(db, userID)
		if err != nil {
			http.Error(w, "failed to list partnerships", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(partnerships)
	}
}

func HandleCreatePartnership(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
			Type string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if body.Type != "couple" && body.Type != "group" {
			http.Error(w, "type must be 'couple' or 'group'", http.StatusBadRequest)
			return
		}
		if body.Name == "" {
			body.Name = body.Type
		}

		userID := auth.UserIDFromContext(r.Context())
		p, err := model.CreatePartnership(db, body.Name, body.Type, userID)
		if err != nil {
			if errors.Is(err, model.ErrAlreadyInCouple) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "you are already in a couple partnership"})
				return
			}
			http.Error(w, "failed to create partnership", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, p)
	}
}

func HandleGetPartnership(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())
		p, err := model.GetPartnership(db, id, userID)
		if err != nil {
			if errors.Is(err, model.ErrNotPartnershipMember) {
				http.Error(w, "partnership not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to get partnership", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func HandleLeavePartnership(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		userID := auth.UserIDFromContext(r.Context())
		if err := model.LeavePartnership(db, id, userID); err != nil {
			if errors.Is(err, model.ErrNotPartnershipMember) {
				http.Error(w, "partnership not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to leave partnership", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func HandleInviteToPartnership(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Username string `json:"username"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if body.Username == "" {
			http.Error(w, "username is required", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		inv, err := model.InviteToPartnership(db, id, userID, body.Username)
		if err != nil {
			switch {
			case errors.Is(err, model.ErrNotPartnershipMember):
				http.Error(w, "partnership not found", http.StatusNotFound)
			case errors.Is(err, model.ErrSelfInvite):
				http.Error(w, "cannot invite yourself", http.StatusBadRequest)
			case errors.Is(err, model.ErrAlreadyMember):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "user is already a member"})
			case errors.Is(err, model.ErrInviteAlreadyPending):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "invitation already pending"})
			case errors.Is(err, model.ErrCoupleIsFull):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "couple partnership is full"})
			case errors.Is(err, model.ErrAlreadyInCouple):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "user is already in a couple partnership"})
			default:
				http.Error(w, err.Error(), http.StatusBadRequest)
			}
			return
		}
		writeJSON(w, http.StatusCreated, inv)
	}
}

func HandleListInvitations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		invitations, err := model.ListInvitations(db, userID)
		if err != nil {
			http.Error(w, "failed to list invitations", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(invitations)
	}
}

func HandleListSentInvitations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		invitations, err := model.ListSentInvitations(db, userID)
		if err != nil {
			http.Error(w, "failed to list sent invitations", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(invitations)
	}
}

func HandleRespondToInvitation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Accept bool `json:"accept"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		userID := auth.UserIDFromContext(r.Context())
		if err := model.RespondToInvitation(db, id, userID, body.Accept); err != nil {
			switch {
			case errors.Is(err, model.ErrInvitationNotFound):
				http.Error(w, "invitation not found", http.StatusNotFound)
			case errors.Is(err, model.ErrCoupleIsFull):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "couple partnership is full"})
			case errors.Is(err, model.ErrAlreadyInCouple):
				writeJSON(w, http.StatusConflict, map[string]string{"error": "you are already in a couple partnership"})
			default:
				http.Error(w, "failed to respond to invitation", http.StatusInternalServerError)
			}
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

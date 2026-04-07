package model

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrAlreadyInCouple      = errors.New("user is already in a couple partnership")
	ErrCoupleIsFull         = errors.New("couple partnership already has 2 members")
	ErrNotPartnershipMember = errors.New("not a member of this partnership")
	ErrAlreadyMember        = errors.New("user is already a member of this partnership")
	ErrInviteAlreadyPending = errors.New("a pending invitation already exists")
	ErrSelfInvite           = errors.New("cannot invite yourself")
	ErrInvitationNotFound   = errors.New("invitation not found")
)

type Partnership struct {
	ID        string              `json:"id"`
	Name      string              `json:"name"`
	Type      string              `json:"type"` // "couple" or "group"
	CreatedBy string              `json:"created_by"`
	Members   []PartnershipMember `json:"members"`
	CreatedAt time.Time           `json:"created_at"`
}

type PartnershipMember struct {
	UserID   string    `json:"user_id"`
	Username string    `json:"username"`
	Name     string    `json:"name"`
	Status   string    `json:"status"` // "active" or "left"
	JoinedAt time.Time `json:"joined_at"`
}

type Invitation struct {
	ID              string    `json:"id"`
	PartnershipID   string    `json:"partnership_id"`
	FromUserID      string    `json:"from_user_id"`
	FromUsername    string    `json:"from_username"`
	FromName        string    `json:"from_name"`
	ToUserID        string    `json:"to_user_id"`
	ToUsername      string    `json:"to_username"`
	ToName          string    `json:"to_name"`
	PartnershipName string    `json:"partnership_name"`
	PartnershipType string    `json:"partnership_type"`
	Status          string    `json:"status"` // "pending", "accepted", "declined"
	CreatedAt       time.Time `json:"created_at"`
}

func CreatePartnership(db *sql.DB, name, partnershipType, userID string) (Partnership, error) {
	if partnershipType == "couple" {
		// Check if user already has an active couple partnership
		var count int
		err := db.QueryRow(`
			SELECT COUNT(*) FROM partnership_members pm
			JOIN partnerships p ON p.id = pm.partnership_id
			WHERE pm.user_id = ? AND pm.status = 'active' AND p.type = 'couple'
		`, userID).Scan(&count)
		if err != nil {
			return Partnership{}, err
		}
		if count > 0 {
			return Partnership{}, ErrAlreadyInCouple
		}
	}

	id := uuid.NewString()
	now := time.Now().UTC()

	_, err := db.Exec(
		`INSERT INTO partnerships (id, name, type, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, name, partnershipType, userID, now.Format(time.RFC3339),
	)
	if err != nil {
		return Partnership{}, err
	}

	// Add creator as first active member
	_, err = db.Exec(
		`INSERT INTO partnership_members (partnership_id, user_id, status, joined_at) VALUES (?, ?, 'active', ?)`,
		id, userID, now.Format(time.RFC3339),
	)
	if err != nil {
		return Partnership{}, err
	}

	return GetPartnership(db, id, userID)
}

func ListPartnerships(db *sql.DB, userID string) ([]Partnership, error) {
	rows, err := db.Query(`
		SELECT DISTINCT p.id FROM partnerships p
		JOIN partnership_members pm ON pm.partnership_id = p.id
		WHERE pm.user_id = ? AND pm.status = 'active'
		ORDER BY p.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	partnerships := []Partnership{}
	for _, id := range ids {
		p, err := GetPartnership(db, id, userID)
		if err != nil {
			return nil, err
		}
		partnerships = append(partnerships, p)
	}
	return partnerships, nil
}

func GetPartnership(db *sql.DB, partnershipID, userID string) (Partnership, error) {
	var p Partnership
	var createdAt string
	err := db.QueryRow(
		`SELECT id, name, type, created_by, created_at FROM partnerships WHERE id = ?`,
		partnershipID,
	).Scan(&p.ID, &p.Name, &p.Type, &p.CreatedBy, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Partnership{}, ErrNotPartnershipMember
		}
		return Partnership{}, err
	}
	p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)

	// Verify caller is a member
	var callerStatus string
	err = db.QueryRow(
		`SELECT status FROM partnership_members WHERE partnership_id = ? AND user_id = ?`,
		partnershipID, userID,
	).Scan(&callerStatus)
	if err != nil || callerStatus != "active" {
		return Partnership{}, ErrNotPartnershipMember
	}

	// Load members
	memberRows, err := db.Query(`
		SELECT pm.user_id, u.username, u.name, pm.status, pm.joined_at
		FROM partnership_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.partnership_id = ?
		ORDER BY pm.joined_at ASC
	`, partnershipID)
	if err != nil {
		return Partnership{}, err
	}
	defer memberRows.Close()

	p.Members = []PartnershipMember{}
	for memberRows.Next() {
		var m PartnershipMember
		var joinedAt string
		if err := memberRows.Scan(&m.UserID, &m.Username, &m.Name, &m.Status, &joinedAt); err != nil {
			return Partnership{}, err
		}
		m.JoinedAt, _ = time.Parse(time.RFC3339, joinedAt)
		p.Members = append(p.Members, m)
	}

	return p, memberRows.Err()
}

func LeavePartnership(db *sql.DB, partnershipID, userID string) error {
	res, err := db.Exec(
		`UPDATE partnership_members SET status = 'left' WHERE partnership_id = ? AND user_id = ? AND status = 'active'`,
		partnershipID, userID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotPartnershipMember
	}
	return nil
}

func InviteToPartnership(db *sql.DB, partnershipID, fromUserID, toUsername string) (Invitation, error) {
	// Look up target user by username
	var toUserID, toUserName string
	err := db.QueryRow(
		`SELECT id, name FROM users WHERE username = ?`, toUsername,
	).Scan(&toUserID, &toUserName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Invitation{}, errors.New("user not found")
		}
		return Invitation{}, err
	}

	// Prevent self-invite
	if toUserID == fromUserID {
		return Invitation{}, ErrSelfInvite
	}

	// Verify inviter is an active member
	var inviterStatus string
	err = db.QueryRow(
		`SELECT status FROM partnership_members WHERE partnership_id = ? AND user_id = ?`,
		partnershipID, fromUserID,
	).Scan(&inviterStatus)
	if err != nil || inviterStatus != "active" {
		return Invitation{}, ErrNotPartnershipMember
	}

	// Check partnership type for couple limits
	var pType string
	err = db.QueryRow(`SELECT type FROM partnerships WHERE id = ?`, partnershipID).Scan(&pType)
	if err != nil {
		return Invitation{}, err
	}

	if pType == "couple" {
		// Couple can only have 2 members
		var count int
		db.QueryRow(
			`SELECT COUNT(*) FROM partnership_members WHERE partnership_id = ? AND status = 'active'`,
			partnershipID,
		).Scan(&count)
		if count >= 2 {
			return Invitation{}, ErrCoupleIsFull
		}

		// Target must not already be in a couple
		var coupleCount int
		db.QueryRow(`
			SELECT COUNT(*) FROM partnership_members pm
			JOIN partnerships p ON p.id = pm.partnership_id
			WHERE pm.user_id = ? AND pm.status = 'active' AND p.type = 'couple'
		`, toUserID).Scan(&coupleCount)
		if coupleCount > 0 {
			return Invitation{}, ErrAlreadyInCouple
		}
	}

	// Prevent inviting an existing active member
	var memberCount int
	db.QueryRow(
		`SELECT COUNT(*) FROM partnership_members WHERE partnership_id = ? AND user_id = ? AND status = 'active'`,
		partnershipID, toUserID,
	).Scan(&memberCount)
	if memberCount > 0 {
		return Invitation{}, ErrAlreadyMember
	}

	// Prevent duplicate pending invitations
	var pendingCount int
	db.QueryRow(
		`SELECT COUNT(*) FROM partnership_invitations WHERE partnership_id = ? AND to_user_id = ? AND status = 'pending'`,
		partnershipID, toUserID,
	).Scan(&pendingCount)
	if pendingCount > 0 {
		return Invitation{}, ErrInviteAlreadyPending
	}

	id := uuid.NewString()
	now := time.Now().UTC()
	_, err = db.Exec(
		`INSERT INTO partnership_invitations (id, partnership_id, from_user_id, to_user_id, status, created_at)
		 VALUES (?, ?, ?, ?, 'pending', ?)`,
		id, partnershipID, fromUserID, toUserID, now.Format(time.RFC3339),
	)
	if err != nil {
		return Invitation{}, err
	}

	return getInvitation(db, id)
}

func ListInvitations(db *sql.DB, userID string) ([]Invitation, error) {
	rows, err := db.Query(`
		SELECT pi.id FROM partnership_invitations pi
		WHERE pi.to_user_id = ? AND pi.status = 'pending'
		ORDER BY pi.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invitations := []Invitation{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		inv, err := getInvitation(db, id)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, rows.Err()
}

func ListSentInvitations(db *sql.DB, userID string) ([]Invitation, error) {
	rows, err := db.Query(`
		SELECT pi.id FROM partnership_invitations pi
		WHERE pi.from_user_id = ? AND pi.status = 'pending'
		ORDER BY pi.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invitations := []Invitation{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		inv, err := getInvitation(db, id)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, rows.Err()
}

func RespondToInvitation(db *sql.DB, invitationID, userID string, accept bool) error {
	// Get the invitation and verify it's for this user
	var partnershipID, toUserID string
	var pType string
	err := db.QueryRow(`
		SELECT pi.partnership_id, pi.to_user_id, p.type
		FROM partnership_invitations pi
		JOIN partnerships p ON p.id = pi.partnership_id
		WHERE pi.id = ? AND pi.status = 'pending'
	`, invitationID).Scan(&partnershipID, &toUserID, &pType)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvitationNotFound
		}
		return err
	}

	if toUserID != userID {
		return ErrInvitationNotFound
	}

	now := time.Now().UTC().Format(time.RFC3339)
	status := "declined"
	if accept {
		status = "accepted"
	}

	_, err = db.Exec(
		`UPDATE partnership_invitations SET status = ?, responded_at = ? WHERE id = ?`,
		status, now, invitationID,
	)
	if err != nil {
		return err
	}

	if !accept {
		return nil
	}

	// Validate couple constraints before adding
	if pType == "couple" {
		var count int
		db.QueryRow(
			`SELECT COUNT(*) FROM partnership_members WHERE partnership_id = ? AND status = 'active'`,
			partnershipID,
		).Scan(&count)
		if count >= 2 {
			return ErrCoupleIsFull
		}
		var coupleCount int
		db.QueryRow(`
			SELECT COUNT(*) FROM partnership_members pm
			JOIN partnerships p ON p.id = pm.partnership_id
			WHERE pm.user_id = ? AND pm.status = 'active' AND p.type = 'couple'
		`, userID).Scan(&coupleCount)
		if coupleCount > 0 {
			return ErrAlreadyInCouple
		}
	}

	_, err = db.Exec(
		`INSERT INTO partnership_members (partnership_id, user_id, status, joined_at)
		 VALUES (?, ?, 'active', ?)
		 ON CONFLICT(partnership_id, user_id) DO UPDATE SET status = 'active', joined_at = ?`,
		partnershipID, userID, now, now,
	)
	return err
}

// GetVisibleAccountIDs returns own account IDs and partner account IDs for the given context.
// When partnershipID is empty, only own accounts are returned (Personal context).
// When set, partner's non-private accounts from that specific partnership are also returned.
func GetVisibleAccountIDs(db *sql.DB, userID, partnershipID string) (own []string, partner []string, err error) {
	// Always fetch own accounts
	ownRows, err := db.Query(`SELECT id FROM accounts WHERE user_id = ?`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer ownRows.Close()
	for ownRows.Next() {
		var id string
		if err := ownRows.Scan(&id); err != nil {
			return nil, nil, err
		}
		own = append(own, id)
	}
	if err := ownRows.Err(); err != nil {
		return nil, nil, err
	}

	if partnershipID == "" {
		return own, nil, nil
	}

	// Fetch partner's non-private accounts from this specific partnership
	partnerRows, err := db.Query(`
		SELECT a.id FROM accounts a
		JOIN partnership_members pm ON pm.user_id = a.user_id AND pm.status = 'active'
		WHERE pm.partnership_id = ? AND a.user_id != ? AND a.is_private = 0
	`, partnershipID, userID)
	if err != nil {
		return own, nil, err
	}
	defer partnerRows.Close()
	for partnerRows.Next() {
		var id string
		if err := partnerRows.Scan(&id); err != nil {
			return own, nil, err
		}
		partner = append(partner, id)
	}
	return own, partner, partnerRows.Err()
}

// GetPartnershipType returns the type of a partnership ("couple" or "group").
// Returns an error if the partnership does not exist or the user is not a member.
func GetPartnershipType(db *sql.DB, partnershipID, userID string) (string, error) {
	var pType string
	err := db.QueryRow(`
		SELECT p.type FROM partnerships p
		JOIN partnership_members pm ON pm.partnership_id = p.id
		WHERE p.id = ? AND pm.user_id = ? AND pm.status = 'active'
	`, partnershipID, userID).Scan(&pType)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotPartnershipMember
		}
		return "", err
	}
	return pType, nil
}

// IsAccountWritableBy returns true if the caller can create transactions on the given account.
// Own accounts: always allowed. Partner's accounts: only if in a couple partnership together.
func IsAccountWritableBy(db *sql.DB, accountID, callerUserID string) (bool, error) {
	var ownerUserID string
	err := db.QueryRow(`SELECT COALESCE(user_id, '') FROM accounts WHERE id = ?`, accountID).Scan(&ownerUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if ownerUserID == "" || ownerUserID == callerUserID {
		return true, nil
	}
	// Check for active couple partnership between caller and account owner
	var count int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM partnership_members pm1
		JOIN partnership_members pm2 ON pm2.partnership_id = pm1.partnership_id
		JOIN partnerships p ON p.id = pm1.partnership_id
		WHERE pm1.user_id = ? AND pm2.user_id = ?
		  AND pm1.status = 'active' AND pm2.status = 'active'
		  AND p.type = 'couple'
	`, callerUserID, ownerUserID).Scan(&count)
	return count > 0, err
}

// GetUnionVisibleAccountIDs returns all account IDs the user can see across all
// their active partnerships (own + all partners' non-private accounts).
// Used for action-level permission checks (confirm, skip, delete).
func GetUnionVisibleAccountIDs(db *sql.DB, userID string) ([]string, error) {
	rows, err := db.Query(`
		SELECT DISTINCT a.id FROM accounts a
		WHERE a.user_id = ?
		UNION
		SELECT DISTINCT a.id FROM accounts a
		JOIN partnership_members pm ON pm.user_id = a.user_id AND pm.status = 'active'
		WHERE pm.partnership_id IN (
			SELECT partnership_id FROM partnership_members WHERE user_id = ? AND status = 'active'
		)
		AND a.user_id != ? AND a.is_private = 0
	`, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// buildInClause returns a SQL placeholder string like "?,?,?" and the args slice.
func buildInClause(ids []string) (string, []any) {
	if len(ids) == 0 {
		return "", nil
	}
	placeholders := strings.Repeat("?,", len(ids))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return placeholders, args
}

func getInvitation(db *sql.DB, id string) (Invitation, error) {
	var inv Invitation
	var createdAt string
	err := db.QueryRow(`
		SELECT pi.id, pi.partnership_id, pi.from_user_id, fu.username, fu.name,
		       pi.to_user_id, tu.username, tu.name,
		       p.name, p.type, pi.status, pi.created_at
		FROM partnership_invitations pi
		JOIN users fu ON fu.id = pi.from_user_id
		JOIN users tu ON tu.id = pi.to_user_id
		JOIN partnerships p ON p.id = pi.partnership_id
		WHERE pi.id = ?
	`, id).Scan(
		&inv.ID, &inv.PartnershipID, &inv.FromUserID, &inv.FromUsername, &inv.FromName,
		&inv.ToUserID, &inv.ToUsername, &inv.ToName,
		&inv.PartnershipName, &inv.PartnershipType, &inv.Status, &createdAt,
	)
	if err != nil {
		return Invitation{}, err
	}
	inv.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return inv, nil
}

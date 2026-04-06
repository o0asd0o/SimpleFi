package model

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrAccountHasTransactions = errors.New("account has transactions")

type Account struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Balance     float64   `json:"balance"`
	IsPrivate   bool      `json:"is_private"`
	OwnerUserID string    `json:"owner_user_id,omitempty"`
	OwnerName   string    `json:"owner_name,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// ListAccounts returns all accounts visible to the user in the given context.
// partnershipID="" → personal context (own accounts only).
// partnershipID set → own + that partnership's non-private accounts.
func ListAccounts(db *sql.DB, userID, partnershipID string) ([]Account, error) {
	own, partner, err := GetVisibleAccountIDs(db, userID, partnershipID)
	if err != nil {
		return nil, err
	}
	all := append(own, partner...)
	return ListAccountsByIDs(db, all, userID)
}

// ListAccountsByIDs fetches accounts with dynamically computed balances.
// Balance counts ALL confirmed transactions on the account regardless of who created them.
func ListAccountsByIDs(db *sql.DB, accountIDs []string, callerUserID string) ([]Account, error) {
	if len(accountIDs) == 0 {
		return []Account{}, nil
	}
	placeholders, args := buildInClause(accountIDs)

	rows, err := db.Query(`
		SELECT a.id, a.name, a.type, COALESCE(a.is_private, 0), a.user_id, COALESCE(u.name, ''), a.created_at,
			COALESCE(SUM(CASE WHEN t.type = 'income'   AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  - COALESCE(SUM(CASE WHEN t.type = 'expense'  AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount ELSE 0 END), 0)
		  AS balance
		FROM accounts a
		LEFT JOIN users u ON u.id = a.user_id
		LEFT JOIN transactions t ON (t.account_id = a.id OR t.to_account_id = a.id)
		  AND COALESCE(t.status, 'confirmed') = 'confirmed'
		WHERE a.id IN (`+placeholders+`)
		GROUP BY a.id
		ORDER BY a.created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []Account{}
	for rows.Next() {
		var a Account
		var isPrivate int
		var ownerUserID string
		var createdAt string
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &isPrivate, &ownerUserID, &a.OwnerName, &createdAt, &a.Balance); err != nil {
			return nil, err
		}
		a.IsPrivate = isPrivate == 1
		a.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		// Only expose owner info if it's a partner's account
		if ownerUserID != callerUserID {
			a.OwnerUserID = ownerUserID
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func CreateAccount(db *sql.DB, a Account, userID string) (Account, error) {
	a.ID = uuid.NewString()
	a.CreatedAt = time.Now().UTC()
	a.Balance = 0

	_, err := db.Exec(
		`INSERT INTO accounts (id, name, type, is_private, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		a.ID, a.Name, a.Type, boolToInt(a.IsPrivate), userID, a.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return Account{}, err
	}
	return a, nil
}

func UpdateAccount(db *sql.DB, id string, name string, accountType string, userID string) (Account, error) {
	res, err := db.Exec(
		`UPDATE accounts SET name = ?, type = ? WHERE id = ? AND user_id = ?`,
		name, accountType, id, userID,
	)
	if err != nil {
		return Account{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Account{}, sql.ErrNoRows
	}
	return Account{ID: id, Name: name, Type: accountType}, nil
}

func SetAccountPrivacy(db *sql.DB, id string, isPrivate bool, userID string) error {
	res, err := db.Exec(
		`UPDATE accounts SET is_private = ? WHERE id = ? AND user_id = ?`,
		boolToInt(isPrivate), id, userID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func DeleteAccount(db *sql.DB, id string, userID string) error {
	// Count ALL transactions on the account (including partner transactions)
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM transactions WHERE account_id = ? OR to_account_id = ?`,
		id, id,
	).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrAccountHasTransactions
	}
	_, err = db.Exec(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, id, userID)
	return err
}

func SeedDefaultAccountForUser(db *sql.DB, userID string) error {
	_, err := db.Exec(
		`INSERT INTO accounts (id, name, type, is_private, user_id, created_at) VALUES (?, ?, ?, 0, ?, ?)`,
		uuid.NewString(), "Cash", "cash", userID, time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// buildAccountsWhereClause returns a WHERE fragment and args for account-based or user-fallback scoping.
func buildAccountsWhereClause(accountIDs []string, callerUserID string) (string, []any) {
	if len(accountIDs) == 0 {
		return "t.user_id = ?", []any{callerUserID}
	}
	placeholders := strings.Repeat("?,", len(accountIDs))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, len(accountIDs)+1)
	for i, id := range accountIDs {
		args[i] = id
	}
	args[len(accountIDs)] = callerUserID
	return "(t.account_id IN (" + placeholders + ") OR (t.account_id IS NULL AND t.user_id = ?))", args
}

package model

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrAccountHasTransactions = errors.New("account has transactions")

type Account struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Balance   float64   `json:"balance"`
	CreatedAt time.Time `json:"created_at"`
}

func ListAccounts(db *sql.DB, userID string) ([]Account, error) {
	rows, err := db.Query(`
		SELECT a.id, a.name, a.type, a.created_at,
			COALESCE(SUM(CASE WHEN t.type = 'income'   AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  - COALESCE(SUM(CASE WHEN t.type = 'expense'  AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.account_id = a.id    THEN t.amount ELSE 0 END), 0)
		  + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount ELSE 0 END), 0)
		  AS balance
		FROM accounts a
		LEFT JOIN transactions t ON (t.account_id = a.id OR t.to_account_id = a.id) AND t.user_id = ?
		WHERE a.user_id = ?
		GROUP BY a.id
		ORDER BY a.created_at ASC
	`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []Account{}
	for rows.Next() {
		var a Account
		var createdAt string
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &createdAt, &a.Balance); err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func CreateAccount(db *sql.DB, a Account, userID string) (Account, error) {
	a.ID = uuid.NewString()
	a.CreatedAt = time.Now().UTC()
	a.Balance = 0

	_, err := db.Exec(
		`INSERT INTO accounts (id, name, type, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
		a.ID, a.Name, a.Type, userID, a.CreatedAt.Format(time.RFC3339),
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

func DeleteAccount(db *sql.DB, id string, userID string) error {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?`,
		id, id, userID,
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
		`INSERT INTO accounts (id, name, type, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
		uuid.NewString(), "Cash", "cash", userID, time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

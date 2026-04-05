package model

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Transaction struct {
	ID          string    `json:"id"`
	Amount      float64   `json:"amount"`
	Type        string    `json:"type"`
	Category    string    `json:"category"`
	CategoryID  string    `json:"category_id,omitempty"`
	Description string    `json:"description"`
	AccountID   string    `json:"account_id"`
	ToAccountID string    `json:"to_account_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type CategoryStat struct {
	Category   string  `json:"category"`
	Icon       string  `json:"icon"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

type AccountStat struct {
	AccountID   string  `json:"account_id"`
	AccountName string  `json:"account_name"`
	AccountType string  `json:"account_type"`
	Amount      float64 `json:"amount"`
	Percentage  float64 `json:"percentage"`
}

type AnalyticsResult struct {
	Period     string         `json:"period"`
	Total      float64        `json:"total"`
	ByCategory []CategoryStat `json:"by_category"`
	ByAccount  []AccountStat  `json:"by_account"`
}

var ErrInvalidPeriod = errors.New("invalid period: use 30d, month, ytd, or lastyear")

func List(db *sql.DB, userID string) ([]Transaction, error) {
	rows, err := db.Query(
		`SELECT t.id, t.amount, t.type, COALESCE(c.name, t.category), COALESCE(t.category_id, ''),
		        COALESCE(t.description, ''),
		        COALESCE(t.account_id, ''), COALESCE(t.to_account_id, ''), t.created_at
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.user_id = ? ORDER BY t.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txs := []Transaction{}
	for rows.Next() {
		var tx Transaction
		var createdAt string
		if err := rows.Scan(&tx.ID, &tx.Amount, &tx.Type, &tx.Category, &tx.CategoryID, &tx.Description,
			&tx.AccountID, &tx.ToAccountID, &createdAt); err != nil {
			return nil, err
		}
		tx.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

func Create(db *sql.DB, tx Transaction, userID string) (Transaction, error) {
	tx.ID = uuid.NewString()
	tx.CreatedAt = time.Now().UTC()

	if tx.Type == "transfer" {
		tx.Category = ""
		tx.CategoryID = ""
	} else if tx.CategoryID == "" && tx.Category == "" {
		tx.Category = "General"
	}

	var accountID, toAccountID, categoryID *string
	if tx.AccountID != "" {
		accountID = &tx.AccountID
	}
	if tx.ToAccountID != "" {
		toAccountID = &tx.ToAccountID
	}
	if tx.CategoryID != "" {
		categoryID = &tx.CategoryID
	}

	_, err := db.Exec(
		`INSERT INTO transactions (id, amount, type, category, category_id, description, account_id, to_account_id, user_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tx.ID, tx.Amount, tx.Type, tx.Category, categoryID, tx.Description,
		accountID, toAccountID, userID, tx.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return Transaction{}, err
	}
	return tx, nil
}

func Statistics(db *sql.DB, userID string, month string) ([]CategoryStat, error) {
	rows, err := db.Query(
		`SELECT COALESCE(c.name, t.category), COALESCE(c.icon, ''), SUM(t.amount)
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.type='expense' AND t.user_id = ? AND strftime('%Y-%m', t.created_at) = ?
		 GROUP BY COALESCE(c.name, t.category) ORDER BY SUM(t.amount) DESC`,
		userID, month,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := []CategoryStat{}
	var total float64

	for rows.Next() {
		var s CategoryStat
		if err := rows.Scan(&s.Category, &s.Icon, &s.Amount); err != nil {
			return nil, err
		}
		total += s.Amount
		stats = append(stats, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if total > 0 {
		for i := range stats {
			stats[i].Percentage = (stats[i].Amount / total) * 100
		}
	}
	return stats, nil
}

func analyticsDateRange(period string) (string, string, error) {
	now := time.Now().UTC()
	var start, end time.Time

	switch period {
	case "30d":
		start = now.AddDate(0, 0, -30)
		end = now
	case "month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = now
	case "ytd":
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		end = now
	case "lastyear":
		start = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC)
		end = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	default:
		return "", "", fmt.Errorf("%w: %s", ErrInvalidPeriod, period)
	}

	return start.Format(time.RFC3339), end.Format(time.RFC3339), nil
}

func Analytics(db *sql.DB, userID string, period string) (AnalyticsResult, error) {
	from, to, err := analyticsDateRange(period)
	if err != nil {
		return AnalyticsResult{}, err
	}

	result := AnalyticsResult{
		Period:     period,
		ByCategory: []CategoryStat{},
		ByAccount:  []AccountStat{},
	}

	// Query A: by category
	catRows, err := db.Query(
		`SELECT COALESCE(c.name, t.category), COALESCE(c.icon, ''), SUM(t.amount)
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.type='expense' AND t.user_id = ? AND t.created_at >= ? AND t.created_at < ?
		 GROUP BY COALESCE(c.name, t.category) ORDER BY SUM(t.amount) DESC`,
		userID, from, to,
	)
	if err != nil {
		return AnalyticsResult{}, err
	}
	defer catRows.Close()

	var catTotal float64
	for catRows.Next() {
		var s CategoryStat
		if err := catRows.Scan(&s.Category, &s.Icon, &s.Amount); err != nil {
			return AnalyticsResult{}, err
		}
		catTotal += s.Amount
		result.ByCategory = append(result.ByCategory, s)
	}
	if err := catRows.Err(); err != nil {
		return AnalyticsResult{}, err
	}
	if catTotal > 0 {
		for i := range result.ByCategory {
			result.ByCategory[i].Percentage = (result.ByCategory[i].Amount / catTotal) * 100
		}
	}
	result.Total = catTotal

	// Query B: by account
	accRows, err := db.Query(
		`SELECT a.id, a.name, a.type, SUM(t.amount)
		 FROM transactions t
		 JOIN accounts a ON a.id = t.account_id
		 WHERE t.type='expense' AND t.user_id = ? AND t.created_at >= ? AND t.created_at < ?
		 GROUP BY a.id, a.name, a.type ORDER BY SUM(t.amount) DESC`,
		userID, from, to,
	)
	if err != nil {
		return AnalyticsResult{}, err
	}
	defer accRows.Close()

	var accTotal float64
	for accRows.Next() {
		var s AccountStat
		if err := accRows.Scan(&s.AccountID, &s.AccountName, &s.AccountType, &s.Amount); err != nil {
			return AnalyticsResult{}, err
		}
		accTotal += s.Amount
		result.ByAccount = append(result.ByAccount, s)
	}
	if err := accRows.Err(); err != nil {
		return AnalyticsResult{}, err
	}
	if accTotal > 0 {
		for i := range result.ByAccount {
			result.ByAccount[i].Percentage = (result.ByAccount[i].Amount / accTotal) * 100
		}
	}

	return result, nil
}

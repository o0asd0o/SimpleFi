package model

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Transaction struct {
	ID              string    `json:"id"`
	Amount          float64   `json:"amount"`
	Type            string    `json:"type"`
	Category        string    `json:"category"`
	CategoryID      string    `json:"category_id,omitempty"`
	Description     string    `json:"description"`
	AccountID       string    `json:"account_id"`
	ToAccountID     string    `json:"to_account_id,omitempty"`
	Status          string    `json:"status"`
	RecurringRuleID string    `json:"recurring_rule_id,omitempty"`
	UserID          string    `json:"user_id,omitempty"`
	UserName        string    `json:"user_name,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
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

type TransactionPage struct {
	Items      []Transaction `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

func List(db *sql.DB, accountIDs []string, callerUserID string, limit int, cursor string) (TransactionPage, error) {
	if limit <= 0 {
		limit = 15
	}

	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)

	var rows *sql.Rows
	var err error

	if cursor == "" {
		args := append(whereArgs, limit+1)
		rows, err = db.Query(
			`SELECT t.id, t.amount, t.type, COALESCE(c.name, t.category), COALESCE(t.category_id, ''),
			        COALESCE(t.description, ''),
			        COALESCE(t.account_id, ''), COALESCE(t.to_account_id, ''),
			        COALESCE(t.status, 'confirmed'), COALESCE(t.recurring_rule_id, ''), t.created_at,
			        COALESCE(t.user_id, ''), COALESCE(u.name, '')
			 FROM transactions t
			 LEFT JOIN categories c ON c.id = t.category_id
			 LEFT JOIN users u ON u.id = t.user_id
			 WHERE `+whereClause+`
		 ORDER BY (CASE WHEN COALESCE(t.status,'confirmed') = 'pending' THEN 0 ELSE 1 END), t.created_at DESC
		 LIMIT ?`,
			args...,
		)
	} else {
		args := append(whereArgs, cursor, limit+1)
		rows, err = db.Query(
			`SELECT t.id, t.amount, t.type, COALESCE(c.name, t.category), COALESCE(t.category_id, ''),
			        COALESCE(t.description, ''),
			        COALESCE(t.account_id, ''), COALESCE(t.to_account_id, ''),
			        COALESCE(t.status, 'confirmed'), COALESCE(t.recurring_rule_id, ''), t.created_at,
			        COALESCE(t.user_id, ''), COALESCE(u.name, '')
			 FROM transactions t
			 LEFT JOIN categories c ON c.id = t.category_id
			 LEFT JOIN users u ON u.id = t.user_id
			 WHERE `+whereClause+` AND t.created_at < ? AND COALESCE(t.status,'confirmed') != 'pending'
		 ORDER BY t.created_at DESC LIMIT ?`,
			args...,
		)
	}
	if err != nil {
		return TransactionPage{}, err
	}
	defer rows.Close()

	txs := []Transaction{}
	for rows.Next() {
		var tx Transaction
		var createdAt string
		if err := rows.Scan(&tx.ID, &tx.Amount, &tx.Type, &tx.Category, &tx.CategoryID, &tx.Description,
			&tx.AccountID, &tx.ToAccountID, &tx.Status, &tx.RecurringRuleID, &createdAt,
			&tx.UserID, &tx.UserName); err != nil {
			return TransactionPage{}, err
		}
		tx.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		txs = append(txs, tx)
	}
	if err := rows.Err(); err != nil {
		return TransactionPage{}, err
	}

	page := TransactionPage{Items: txs}
	if len(txs) > limit {
		page.Items = txs[:limit]
		page.NextCursor = txs[limit-1].CreatedAt.Format(time.RFC3339)
	}
	return page, nil
}

func Create(db *sql.DB, tx Transaction, userID string) (Transaction, error) {
	tx.ID = uuid.NewString()
	tx.CreatedAt = time.Now().UTC()
	if tx.Status == "" {
		tx.Status = "confirmed"
	}

	if tx.Type == "transfer" {
		tx.Category = ""
		tx.CategoryID = ""
	} else if tx.CategoryID == "" && tx.Category == "" {
		tx.Category = "General"
	}

	var accountID, toAccountID, categoryID, recurringRuleID *string
	if tx.AccountID != "" {
		accountID = &tx.AccountID
	}
	if tx.ToAccountID != "" {
		toAccountID = &tx.ToAccountID
	}
	if tx.CategoryID != "" {
		categoryID = &tx.CategoryID
	}
	if tx.RecurringRuleID != "" {
		recurringRuleID = &tx.RecurringRuleID
	}

	_, err := db.Exec(
		`INSERT INTO transactions (id, amount, type, category, category_id, description, account_id, to_account_id, user_id, status, recurring_rule_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tx.ID, tx.Amount, tx.Type, tx.Category, categoryID, tx.Description,
		accountID, toAccountID, userID, tx.Status, recurringRuleID, tx.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return Transaction{}, err
	}
	tx.UserID = userID
	return tx, nil
}

func Update(db *sql.DB, id string, tx Transaction, userID string) (Transaction, error) {
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

	res, err := db.Exec(
		`UPDATE transactions SET amount=?, type=?, category=?, category_id=?, description=?,
		        account_id=?, to_account_id=?
		 WHERE id=? AND user_id=?`,
		tx.Amount, tx.Type, tx.Category, categoryID, tx.Description,
		accountID, toAccountID, id, userID,
	)
	if err != nil {
		return Transaction{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Transaction{}, sql.ErrNoRows
	}

	tx.ID = id
	tx.UserID = userID
	return tx, nil
}

// Delete removes a transaction if the caller has permission (owns an account involved).
func Delete(db *sql.DB, id string, accountIDs []string, callerUserID string) error {
	// Verify access first using GetTransaction (which aliases the table correctly)
	if _, err := GetTransaction(db, id, accountIDs, callerUserID); err != nil {
		return err // sql.ErrNoRows if not found or no permission
	}
	res, err := db.Exec(`DELETE FROM transactions WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetTransaction fetches a transaction if the caller has permission.
func GetTransaction(db *sql.DB, id string, accountIDs []string, callerUserID string) (Transaction, error) {
	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)
	args := append([]any{id}, whereArgs...)

	var tx Transaction
	var createdAt string
	err := db.QueryRow(
		`SELECT t.id, t.amount, t.type, COALESCE(c.name, t.category), COALESCE(t.category_id, ''),
		        COALESCE(t.description, ''), COALESCE(t.account_id, ''), COALESCE(t.to_account_id, ''),
		        COALESCE(t.status, 'confirmed'), COALESCE(t.recurring_rule_id, ''), t.created_at,
		        COALESCE(t.user_id, ''), COALESCE(u.name, '')
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 LEFT JOIN users u ON u.id = t.user_id
		 WHERE t.id = ? AND `+whereClause,
		args...,
	).Scan(&tx.ID, &tx.Amount, &tx.Type, &tx.Category, &tx.CategoryID, &tx.Description,
		&tx.AccountID, &tx.ToAccountID, &tx.Status, &tx.RecurringRuleID, &createdAt,
		&tx.UserID, &tx.UserName)
	if err != nil {
		return Transaction{}, err
	}
	tx.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return tx, nil
}

// ConfirmTransaction confirms a pending transaction by ID only (access already validated by caller).
func ConfirmTransaction(db *sql.DB, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`UPDATE transactions SET status = 'confirmed', created_at = ? WHERE id = ? AND status = 'pending'`,
		now, id,
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

func DeletePendingByRule(db *sql.DB, ruleID, userID string) error {
	_, err := db.Exec(
		`DELETE FROM transactions WHERE recurring_rule_id = ? AND user_id = ? AND status = 'pending'`,
		ruleID, userID,
	)
	return err
}

func SetRecurringRuleID(db *sql.DB, txID, userID, ruleID string) error {
	_, err := db.Exec(
		`UPDATE transactions SET recurring_rule_id = ? WHERE id = ? AND user_id = ?`,
		ruleID, txID, userID,
	)
	return err
}

// Statistics returns expense breakdown by category for a month.
// accountIDs scopes which accounts to aggregate. filterUserID (optional) narrows to one person's transactions.
func Statistics(db *sql.DB, accountIDs []string, callerUserID string, month string, filterUserID string) ([]CategoryStat, error) {
	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)
	args := append(whereArgs, month)

	extraFilter := ""
	if filterUserID != "" {
		extraFilter = " AND t.user_id = ?"
		args = append(args, filterUserID)
	}

	rows, err := db.Query(
		`SELECT COALESCE(c.name, t.category), COALESCE(c.icon, ''), SUM(t.amount)
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE `+whereClause+` AND t.type='expense' AND strftime('%Y-%m', t.created_at) = ?
		   AND COALESCE(t.status, 'confirmed') = 'confirmed'`+extraFilter+`
		 GROUP BY COALESCE(c.name, t.category) ORDER BY SUM(t.amount) DESC`,
		args...,
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

// Analytics returns expense analytics for a period.
// accountIDs scopes which accounts to aggregate. filterUserID (optional) narrows to one person.
func Analytics(db *sql.DB, accountIDs []string, callerUserID string, period string, filterUserID string) (AnalyticsResult, error) {
	from, to, err := analyticsDateRange(period)
	if err != nil {
		return AnalyticsResult{}, err
	}

	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)

	extraFilter := ""
	filterArgs := []any{}
	if filterUserID != "" {
		extraFilter = " AND t.user_id = ?"
		filterArgs = append(filterArgs, filterUserID)
	}

	result := AnalyticsResult{
		Period:     period,
		ByCategory: []CategoryStat{},
		ByAccount:  []AccountStat{},
	}

	// Query A: by category
	catArgs := append(whereArgs, from, to)
	catArgs = append(catArgs, filterArgs...)
	catRows, err := db.Query(
		`SELECT COALESCE(c.name, t.category), COALESCE(c.icon, ''), SUM(t.amount)
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE `+whereClause+` AND t.type='expense' AND t.created_at >= ? AND t.created_at < ?
		   AND COALESCE(t.status, 'confirmed') = 'confirmed'`+extraFilter+`
		 GROUP BY COALESCE(c.name, t.category) ORDER BY SUM(t.amount) DESC`,
		catArgs...,
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
	accArgs := append(whereArgs, from, to)
	accArgs = append(accArgs, filterArgs...)
	accRows, err := db.Query(
		`SELECT a.id, a.name, a.type, SUM(t.amount)
		 FROM transactions t
		 JOIN accounts a ON a.id = t.account_id
		 WHERE `+whereClause+` AND t.type='expense' AND t.created_at >= ? AND t.created_at < ?
		   AND COALESCE(t.status, 'confirmed') = 'confirmed'`+extraFilter+`
		 GROUP BY a.id, a.name, a.type ORDER BY SUM(t.amount) DESC`,
		accArgs...,
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

// ExportRow holds flattened transaction data suitable for CSV export.
type ExportRow struct {
	CreatedAt   time.Time
	Type        string
	Category    string
	Description string
	Amount      float64
	Account     string
	ToAccount   string
	Status      string
}

// ExportAll returns all transactions for the given account scope, ordered by date descending.
// Account and category names are resolved via joins.
func ExportAll(db *sql.DB, accountIDs []string, callerUserID string) ([]ExportRow, error) {
	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)

	rows, err := db.Query(
		`SELECT t.created_at, t.type,
		        COALESCE(c.name, t.category, ''),
		        COALESCE(t.description, ''),
		        t.amount,
		        COALESCE(a.name, ''),
		        COALESCE(ta.name, ''),
		        COALESCE(t.status, 'confirmed')
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 LEFT JOIN accounts a ON a.id = t.account_id
		 LEFT JOIN accounts ta ON ta.id = t.to_account_id
		 WHERE `+whereClause+`
		 ORDER BY t.created_at DESC`,
		whereArgs...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ExportRow
	for rows.Next() {
		var row ExportRow
		var createdAt string
		if err := rows.Scan(&createdAt, &row.Type, &row.Category, &row.Description,
			&row.Amount, &row.Account, &row.ToAccount, &row.Status); err != nil {
			return nil, err
		}
		row.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		result = append(result, row)
	}
	return result, rows.Err()
}

// AnalyticsTrendPoint is a single data point for the spending trend chart.
type AnalyticsTrendPoint struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

// AnalyticsTrend returns daily or weekly aggregated expense totals for the given period.
func AnalyticsTrend(db *sql.DB, accountIDs []string, callerUserID string, period string, filterUserID string) ([]AnalyticsTrendPoint, error) {
	from, to, err := analyticsDateRange(period)
	if err != nil {
		return nil, err
	}

	whereClause, whereArgs := buildAccountsWhereClause(accountIDs, callerUserID)

	extraFilter := ""
	if filterUserID != "" {
		extraFilter = " AND t.user_id = ?"
		whereArgs = append(whereArgs, filterUserID)
	}

	// Use daily buckets for 30d/month, weekly for ytd, monthly for lastyear
	var dateFmt string
	switch period {
	case "lastyear":
		dateFmt = "%Y-%m"
	case "ytd":
		dateFmt = "%Y-W%W"
	default:
		dateFmt = "%Y-%m-%d"
	}

	args := append(whereArgs, from, to)
	rows, err := db.Query(
		`SELECT strftime('`+dateFmt+`', t.created_at) AS bucket, COALESCE(SUM(t.amount), 0)
		 FROM transactions t
		 WHERE `+whereClause+` AND t.type = 'expense'
		   AND t.created_at >= ? AND t.created_at < ?
		   AND COALESCE(t.status, 'confirmed') = 'confirmed'`+extraFilter+`
		 GROUP BY bucket
		 ORDER BY bucket ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []AnalyticsTrendPoint
	for rows.Next() {
		var p AnalyticsTrendPoint
		if err := rows.Scan(&p.Label, &p.Amount); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if points == nil {
		points = []AnalyticsTrendPoint{}
	}
	return points, rows.Err()
}

package model

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrBudgetNotFound = errors.New("budget not found")

// Budget represents a spending limit set by a user.
type Budget struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	AccountID  string    `json:"account_id,omitempty"` // empty = whole balance (all visible accounts)
	Name       string    `json:"name"`
	Amount     float64   `json:"amount"`
	PeriodType string    `json:"period_type"` // month | year | custom
	StartDate  string    `json:"start_date,omitempty"`
	EndDate    string    `json:"end_date,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// BudgetCategoryLimit is a per-category spending limit within a budget.
type BudgetCategoryLimit struct {
	ID         string  `json:"id"`
	BudgetID   string  `json:"budget_id"`
	CategoryID string  `json:"category_id"`
	Amount     float64 `json:"amount"`
}

// BudgetCategoryProgress is a per-category spending progress report.
type BudgetCategoryProgress struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Icon         string  `json:"icon"`
	Limit        float64 `json:"limit"`
	Spent        float64 `json:"spent"`
	Percentage   float64 `json:"percentage"`
}

// BudgetProgress is a budget with real-time spending progress.
type BudgetProgress struct {
	Budget
	Spent      float64                  `json:"spent"`
	Remaining  float64                  `json:"remaining"`
	Percentage float64                  `json:"percentage"`
	Categories []BudgetCategoryProgress `json:"categories"`
}

// budgetDateRange returns the start and end datetime strings for a given period_type.
// For month/year it resolves relative to the current time.
func budgetDateRange(periodType, startDate, endDate string) (string, string) {
	now := time.Now()
	switch periodType {
	case "month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end := start.AddDate(0, 1, 0)
		return start.Format("2006-01-02"), end.Format("2006-01-02")
	case "year":
		start := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		end := start.AddDate(1, 0, 0)
		return start.Format("2006-01-02"), end.Format("2006-01-02")
	default: // custom
		return startDate, endDate
	}
}

// computeSpent queries the total confirmed expense amount for the given accounts
// within the date range, optionally filtered to a specific category.
// Excludes: transfers (type != 'expense'), credit card payments (expense with to_account_id set).
func computeSpent(db *sql.DB, accountIDs []string, callerUserID, categoryID, start, end string) (float64, error) {
	var whereClause string
	var args []any

	if len(accountIDs) == 0 {
		whereClause = "t.user_id = ?"
		args = []any{callerUserID}
	} else {
		placeholders := strings.Repeat("?,", len(accountIDs))
		placeholders = placeholders[:len(placeholders)-1]
		whereClause = "(t.account_id IN (" + placeholders + ") OR (t.account_id IS NULL AND t.user_id = ?))"
		args = make([]any, len(accountIDs)+1)
		for i, id := range accountIDs {
			args[i] = id
		}
		args[len(accountIDs)] = callerUserID
	}

	// Append date range and type filters
	args = append(args, start, end)
	query := `SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
		WHERE ` + whereClause + `
		AND t.type = 'expense'
		AND t.status = 'confirmed'
		AND (t.to_account_id IS NULL OR t.to_account_id = '')
		AND t.created_at >= ? AND t.created_at < ?`

	if categoryID != "" {
		query += ` AND t.category_id = ?`
		args = append(args, categoryID)
	}

	var spent float64
	if err := db.QueryRow(query, args...).Scan(&spent); err != nil {
		return 0, err
	}
	return spent, nil
}

// resolveBudgetAccountIDs returns the accountIDs to scope a budget's spend query.
// If budget has a specific account_id, only that account is used.
// Otherwise, all user-visible accountIDs are used.
func resolveBudgetAccountIDs(b Budget, allAccountIDs []string) []string {
	if b.AccountID != "" {
		return []string{b.AccountID}
	}
	return allAccountIDs
}

// loadBudgetProgress attaches live spending data to a Budget.
func loadBudgetProgress(db *sql.DB, b Budget, allAccountIDs []string, callerUserID string) (BudgetProgress, error) {
	start, end := budgetDateRange(b.PeriodType, b.StartDate, b.EndDate)
	scopedIDs := resolveBudgetAccountIDs(b, allAccountIDs)

	spent, err := computeSpent(db, scopedIDs, callerUserID, "", start, end)
	if err != nil {
		return BudgetProgress{}, err
	}

	// Load category limits: drain into slice first to avoid nested cursor / connection re-use issues.
	type catRow struct {
		bl      BudgetCategoryLimit
		catName string
		catIcon string
	}
	rows, err := db.Query(`
		SELECT bc.id, bc.budget_id, bc.category_id, bc.amount, COALESCE(c.name,''), COALESCE(c.icon,'')
		FROM budget_categories bc
		LEFT JOIN categories c ON c.id = bc.category_id
		WHERE bc.budget_id = ?`, b.ID)
	if err != nil {
		return BudgetProgress{}, err
	}
	var catRows []catRow
	for rows.Next() {
		var row catRow
		if err := rows.Scan(&row.bl.ID, &row.bl.BudgetID, &row.bl.CategoryID, &row.bl.Amount, &row.catName, &row.catIcon); err != nil {
			rows.Close()
			return BudgetProgress{}, err
		}
		catRows = append(catRows, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return BudgetProgress{}, err
	}

	var categories []BudgetCategoryProgress
	for _, row := range catRows {
		catSpent, err := computeSpent(db, scopedIDs, callerUserID, row.bl.CategoryID, start, end)
		if err != nil {
			return BudgetProgress{}, err
		}
		pct := 0.0
		if row.bl.Amount > 0 {
			pct = catSpent / row.bl.Amount * 100
		}
		categories = append(categories, BudgetCategoryProgress{
			CategoryID:   row.bl.CategoryID,
			CategoryName: row.catName,
			Icon:         row.catIcon,
			Limit:        row.bl.Amount,
			Spent:        catSpent,
			Percentage:   pct,
		})
	}
	if categories == nil {
		categories = []BudgetCategoryProgress{}
	}

	pct := 0.0
	if b.Amount > 0 {
		pct = spent / b.Amount * 100
	}

	return BudgetProgress{
		Budget:     b,
		Spent:      spent,
		Remaining:  b.Amount - spent,
		Percentage: pct,
		Categories: categories,
	}, nil
}

// ListBudgets returns all budgets for userID with live spending progress.
func ListBudgets(db *sql.DB, userID string, allAccountIDs []string) ([]BudgetProgress, error) {
	rows, err := db.Query(`
		SELECT id, user_id, COALESCE(account_id,''), name, amount, period_type,
		       COALESCE(start_date,''), COALESCE(end_date,''), created_at
		FROM budgets WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	// Drain into slice before closing, to avoid nested cursor / connection re-use with ":memory:" DBs.
	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.AccountID, &b.Name, &b.Amount,
			&b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		budgets = append(budgets, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var result []BudgetProgress
	for _, b := range budgets {
		bp, err := loadBudgetProgress(db, b, allAccountIDs, userID)
		if err != nil {
			return nil, err
		}
		result = append(result, bp)
	}
	if result == nil {
		result = []BudgetProgress{}
	}
	return result, nil
}

// GetBudget returns a single budget with live spending progress.
func GetBudget(db *sql.DB, budgetID, userID string, allAccountIDs []string) (BudgetProgress, error) {
	var b Budget
	err := db.QueryRow(`
		SELECT id, user_id, COALESCE(account_id,''), name, amount, period_type,
		       COALESCE(start_date,''), COALESCE(end_date,''), created_at
		FROM budgets WHERE id = ? AND user_id = ?`, budgetID, userID).
		Scan(&b.ID, &b.UserID, &b.AccountID, &b.Name, &b.Amount,
			&b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return BudgetProgress{}, ErrBudgetNotFound
	}
	if err != nil {
		return BudgetProgress{}, err
	}
	return loadBudgetProgress(db, b, allAccountIDs, userID)
}

// BudgetInput holds the data for creating or updating a budget.
type BudgetInput struct {
	AccountID  string                    `json:"account_id"`
	Name       string                    `json:"name"`
	Amount     float64                   `json:"amount"`
	PeriodType string                    `json:"period_type"`
	StartDate  string                    `json:"start_date"`
	EndDate    string                    `json:"end_date"`
	Categories []BudgetCategoryLimitInput `json:"categories"`
}

type BudgetCategoryLimitInput struct {
	CategoryID string  `json:"category_id"`
	Amount     float64 `json:"amount"`
}

// CreateBudget inserts a new budget and its optional category limits.
func CreateBudget(db *sql.DB, userID string, input BudgetInput) (BudgetProgress, error) {
	budgetID := uuid.New().String()
	accountID := sql.NullString{String: input.AccountID, Valid: input.AccountID != ""}

	tx, err := db.Begin()
	if err != nil {
		return BudgetProgress{}, err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`INSERT INTO budgets (id, user_id, account_id, name, amount, period_type, start_date, end_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		budgetID, userID, accountID,
		input.Name, input.Amount, input.PeriodType,
		nullString(input.StartDate), nullString(input.EndDate))
	if err != nil {
		return BudgetProgress{}, err
	}

	for _, cat := range input.Categories {
		if _, err := tx.Exec(`INSERT INTO budget_categories (id, budget_id, category_id, amount) VALUES (?,?,?,?)`,
			uuid.New().String(), budgetID, cat.CategoryID, cat.Amount); err != nil {
			return BudgetProgress{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return BudgetProgress{}, err
	}

	return GetBudget(db, budgetID, userID, nil)
}

// UpdateBudget replaces a budget's fields and its category limits.
func UpdateBudget(db *sql.DB, budgetID, userID string, input BudgetInput, allAccountIDs []string) (BudgetProgress, error) {
	accountID := sql.NullString{String: input.AccountID, Valid: input.AccountID != ""}

	tx, err := db.Begin()
	if err != nil {
		return BudgetProgress{}, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`UPDATE budgets SET account_id=?, name=?, amount=?, period_type=?, start_date=?, end_date=?
		WHERE id=? AND user_id=?`,
		accountID, input.Name, input.Amount, input.PeriodType,
		nullString(input.StartDate), nullString(input.EndDate),
		budgetID, userID)
	if err != nil {
		return BudgetProgress{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return BudgetProgress{}, ErrBudgetNotFound
	}

	// Replace all category limits
	if _, err := tx.Exec(`DELETE FROM budget_categories WHERE budget_id = ?`, budgetID); err != nil {
		return BudgetProgress{}, err
	}
	for _, cat := range input.Categories {
		if _, err := tx.Exec(`INSERT INTO budget_categories (id, budget_id, category_id, amount) VALUES (?,?,?,?)`,
			uuid.New().String(), budgetID, cat.CategoryID, cat.Amount); err != nil {
			return BudgetProgress{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return BudgetProgress{}, err
	}

	return GetBudget(db, budgetID, userID, allAccountIDs)
}

// DeleteBudget removes a budget owned by userID and its associated category limits.
func DeleteBudget(db *sql.DB, budgetID, userID string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`DELETE FROM budgets WHERE id = ? AND user_id = ?`, budgetID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrBudgetNotFound
	}
	if _, err := tx.Exec(`DELETE FROM budget_categories WHERE budget_id = ?`, budgetID); err != nil {
		return err
	}
	return tx.Commit()
}

func nullString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

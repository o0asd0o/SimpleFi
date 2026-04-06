package model

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type RecurringRule struct {
	ID          string    `json:"id"`
	Amount      float64   `json:"amount"`
	Type        string    `json:"type"`
	Category    string    `json:"category"`
	CategoryID  string    `json:"category_id,omitempty"`
	Description string    `json:"description"`
	AccountID   string    `json:"account_id"`
	ToAccountID string    `json:"to_account_id,omitempty"`
	Frequency   string    `json:"frequency"`
	NextDue     string    `json:"next_due"`
	EndDate     string    `json:"end_date,omitempty"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at"`
}

func ListRecurringRules(db *sql.DB, userID string) ([]RecurringRule, error) {
	rows, err := db.Query(
		`SELECT id, amount, type, COALESCE(category, ''), COALESCE(category_id, ''),
		        COALESCE(description, ''), COALESCE(account_id, ''), COALESCE(to_account_id, ''),
		        frequency, next_due, COALESCE(end_date, ''), active, created_at
		 FROM recurring_rules WHERE user_id = ? AND active = 1 ORDER BY next_due ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []RecurringRule{}
	for rows.Next() {
		var r RecurringRule
		var active int
		var createdAt string
		if err := rows.Scan(&r.ID, &r.Amount, &r.Type, &r.Category, &r.CategoryID,
			&r.Description, &r.AccountID, &r.ToAccountID,
			&r.Frequency, &r.NextDue, &r.EndDate, &active, &createdAt); err != nil {
			return nil, err
		}
		r.Active = active == 1
		r.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func CreateRecurringRule(db *sql.DB, r RecurringRule, userID string) (RecurringRule, error) {
	r.ID = uuid.NewString()
	r.CreatedAt = time.Now().UTC()
	r.Active = true

	var accountID, toAccountID, categoryID, endDate *string
	if r.AccountID != "" {
		accountID = &r.AccountID
	}
	if r.ToAccountID != "" {
		toAccountID = &r.ToAccountID
	}
	if r.CategoryID != "" {
		categoryID = &r.CategoryID
	}
	if r.EndDate != "" {
		endDate = &r.EndDate
	}

	_, err := db.Exec(
		`INSERT INTO recurring_rules (id, user_id, amount, type, category, category_id,
		    description, account_id, to_account_id, frequency, next_due, end_date, active, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
		r.ID, userID, r.Amount, r.Type, r.Category, categoryID,
		r.Description, accountID, toAccountID, r.Frequency, r.NextDue, endDate, r.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return RecurringRule{}, err
	}
	return r, nil
}

func DeleteRecurringRule(db *sql.DB, id, userID string) error {
	res, err := db.Exec(`UPDATE recurring_rules SET active = 0 WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func UpdateRecurringRule(db *sql.DB, id, userID string, frequency, nextDue, endDate string) error {
	var endDatePtr *string
	if endDate != "" {
		endDatePtr = &endDate
	}
	res, err := db.Exec(
		`UPDATE recurring_rules SET frequency = ?, next_due = ?, end_date = ? WHERE id = ? AND user_id = ? AND active = 1`,
		frequency, nextDue, endDatePtr, id, userID,
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

func AdvanceNextDue(db *sql.DB, ruleID, userID string) error {
	var nextDue string
	var frequency string
	var endDate sql.NullString
	err := db.QueryRow(
		`SELECT next_due, frequency, end_date FROM recurring_rules WHERE id = ? AND user_id = ?`,
		ruleID, userID,
	).Scan(&nextDue, &frequency, &endDate)
	if err != nil {
		return err
	}

	current, err := time.Parse("2006-01-02", nextDue)
	if err != nil {
		return err
	}

	next := AdvanceDatePublic(current, frequency)
	nextStr := next.Format("2006-01-02")

	// If end_date is set and the new next_due is past it, deactivate the rule
	if endDate.Valid && endDate.String != "" && nextStr > endDate.String {
		_, err = db.Exec(
			`UPDATE recurring_rules SET active = 0 WHERE id = ? AND user_id = ?`,
			ruleID, userID,
		)
		return err
	}

	_, err = db.Exec(
		`UPDATE recurring_rules SET next_due = ? WHERE id = ? AND user_id = ?`,
		nextStr, ruleID, userID,
	)
	return err
}

func AdvanceDatePublic(from time.Time, frequency string) time.Time {
	switch frequency {
	case "daily":
		return from.AddDate(0, 0, 1)
	case "weekly":
		return from.AddDate(0, 0, 7)
	case "biweekly":
		return from.AddDate(0, 0, 14)
	case "monthly":
		return from.AddDate(0, 1, 0)
	case "yearly":
		return from.AddDate(1, 0, 0)
	default:
		return from.AddDate(0, 1, 0)
	}
}

func GeneratePendingTransactions(db *sql.DB, userID string) error {
	today := time.Now().UTC().Format("2006-01-02")

	rules, err := db.Query(
		`SELECT id, amount, type, COALESCE(category, ''), COALESCE(category_id, ''),
		        COALESCE(description, ''), COALESCE(account_id, ''), COALESCE(to_account_id, ''),
		        frequency, next_due, COALESCE(end_date, '')
		 FROM recurring_rules WHERE user_id = ? AND active = 1 AND next_due <= ?`,
		userID, today,
	)
	if err != nil {
		return err
	}
	defer rules.Close()

	type ruleRow struct {
		id, typ, category, categoryID, description, accountID, toAccountID, frequency, nextDue, endDate string
		amount                                                                                          float64
	}
	var dueRules []ruleRow
	for rules.Next() {
		var r ruleRow
		if err := rules.Scan(&r.id, &r.amount, &r.typ, &r.category, &r.categoryID,
			&r.description, &r.accountID, &r.toAccountID, &r.frequency, &r.nextDue, &r.endDate); err != nil {
			return err
		}
		dueRules = append(dueRules, r)
	}
	if err := rules.Err(); err != nil {
		return err
	}

	for _, r := range dueRules {
		// If end_date is set and next_due is past it, deactivate the rule
		if r.endDate != "" && r.nextDue > r.endDate {
			db.Exec(`UPDATE recurring_rules SET active = 0 WHERE id = ?`, r.id)
			continue
		}

		var count int
		err := db.QueryRow(
			`SELECT COUNT(*) FROM transactions WHERE recurring_rule_id = ? AND status = 'pending' AND user_id = ?`,
			r.id, userID,
		).Scan(&count)
		if err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		// Parse next_due as the created_at for the pending transaction
		dueDate, _ := time.Parse("2006-01-02", r.nextDue)
		createdAt := dueDate.Format(time.RFC3339)

		var accountID, toAccountID, categoryID *string
		if r.accountID != "" {
			accountID = &r.accountID
		}
		if r.toAccountID != "" {
			toAccountID = &r.toAccountID
		}
		if r.categoryID != "" {
			categoryID = &r.categoryID
		}

		_, err = db.Exec(
			`INSERT INTO transactions (id, amount, type, category, category_id, description,
			    account_id, to_account_id, user_id, status, recurring_rule_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
			uuid.NewString(), r.amount, r.typ, r.category, categoryID, r.description,
			accountID, toAccountID, userID, r.id, createdAt,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

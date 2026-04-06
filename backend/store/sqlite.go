package store

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func New(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, err
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		return nil, err
	}

	if err := migrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			amount REAL NOT NULL,
			type TEXT NOT NULL,
			category TEXT DEFAULT 'General',
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_category ON transactions(category)`,
		`CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			name TEXT NOT NULL,
			passphrase_hash TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		`CREATE TABLE IF NOT EXISTS categories (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			icon TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS user_categories (
			user_id TEXT NOT NULL,
			category_id TEXT NOT NULL,
			PRIMARY KEY (user_id, category_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_user_categories_user ON user_categories(user_id)`,
		`CREATE TABLE IF NOT EXISTS recurring_rules (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			amount REAL NOT NULL,
			type TEXT NOT NULL,
			category TEXT DEFAULT '',
			category_id TEXT,
			description TEXT,
			account_id TEXT,
			to_account_id TEXT,
			frequency TEXT NOT NULL,
			next_due TEXT NOT NULL,
			active INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_id ON recurring_rules(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_rules_next_due ON recurring_rules(next_due)`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	// Add columns to transactions (idempotent)
	if err := addColumnIfNotExists(db, "transactions", "account_id", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(db, "transactions", "to_account_id", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(db, "transactions", "user_id", "TEXT"); err != nil {
		return err
	}

	// Add user_id to accounts
	if err := addColumnIfNotExists(db, "accounts", "user_id", "TEXT"); err != nil {
		return err
	}

	// Add category_id to transactions
	if err := addColumnIfNotExists(db, "transactions", "category_id", "TEXT"); err != nil {
		return err
	}

	// Add end_date to recurring_rules
	if err := addColumnIfNotExists(db, "recurring_rules", "end_date", "TEXT"); err != nil {
		return err
	}

	// Add status + recurring_rule_id to transactions
	if err := addColumnIfNotExists(db, "transactions", "status", "TEXT NOT NULL DEFAULT 'confirmed'"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(db, "transactions", "recurring_rule_id", "TEXT"); err != nil {
		return err
	}

	// Indexes
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_account_id ON transactions(account_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_recurring_rule_id ON transactions(recurring_rule_id)`,
	}
	for _, idx := range indexes {
		if _, err := db.Exec(idx); err != nil {
			return err
		}
	}

	// Add is_private to accounts
	if err := addColumnIfNotExists(db, "accounts", "is_private", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}

	// Partnership tables
	partnershipStmts := []string{
		`CREATE TABLE IF NOT EXISTS partnerships (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL DEFAULT '',
			type TEXT NOT NULL DEFAULT 'group',
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS partnership_members (
			partnership_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (partnership_id, user_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pm_user ON partnership_members(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pm_partnership ON partnership_members(partnership_id)`,
		`CREATE TABLE IF NOT EXISTS partnership_invitations (
			id TEXT PRIMARY KEY,
			partnership_id TEXT NOT NULL,
			from_user_id TEXT NOT NULL,
			to_user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			responded_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pi_to_user ON partnership_invitations(to_user_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_pi_partnership ON partnership_invitations(partnership_id)`,
	}
	for _, stmt := range partnershipStmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	// Add type column to categories
	if err := addColumnIfNotExists(db, "categories", "type", "TEXT NOT NULL DEFAULT 'expense'"); err != nil {
		return err
	}
	// Migrate Salary to income type
	if _, err := db.Exec(`UPDATE categories SET type = 'income' WHERE id = 'cat-salary'`); err != nil {
		return err
	}

	// Seed default global categories (idempotent via INSERT OR IGNORE + UNIQUE name)
	defaultCategories := []struct{ id, name, icon, catType string }{
		{"cat-food", "Food", "🍔", "expense"},
		{"cat-transport", "Transport", "🚗", "expense"},
		{"cat-bills", "Bills", "🧾", "expense"},
		{"cat-entertainment", "Entertainment", "🎬", "expense"},
		{"cat-salary", "Salary", "💰", "income"},
		{"cat-general", "General", "📦", "expense"},
		{"cat-gift", "Gift", "🎁", "income"},
		{"cat-others", "Others", "📦", "income"},
	}
	for i, c := range defaultCategories {
		_, err := db.Exec(
			`INSERT OR IGNORE INTO categories (id, name, icon, type, sort_order, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
			c.id, c.name, c.icon, c.catType, i,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func addColumnIfNotExists(db *sql.DB, table, column, colType string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var dfltValue *string
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}

	_, err = db.Exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + colType)
	return err
}

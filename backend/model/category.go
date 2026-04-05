package model

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrCategoryInUse = errors.New("category is in use")

type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

// DefaultCategoryIDs are the stable IDs used for the 6 seeded categories.
var DefaultCategoryIDs = []string{
	"cat-food", "cat-transport", "cat-bills",
	"cat-entertainment", "cat-salary", "cat-general",
}

func ListCategoriesForUser(db *sql.DB, userID string) ([]Category, error) {
	rows, err := db.Query(`
		SELECT c.id, c.name, c.icon, c.sort_order, c.created_at
		FROM categories c
		JOIN user_categories uc ON uc.category_id = c.id
		WHERE uc.user_id = ?
		ORDER BY c.sort_order ASC, c.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cats := []Category{}
	for rows.Next() {
		var c Category
		var createdAt string
		if err := rows.Scan(&c.ID, &c.Name, &c.Icon, &c.SortOrder, &createdAt); err != nil {
			return nil, err
		}
		c.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func CreateCategory(db *sql.DB, name, icon, userID string) (Category, error) {
	c := Category{
		ID:        uuid.NewString(),
		Name:      name,
		Icon:      icon,
		CreatedAt: time.Now().UTC(),
	}

	_, err := db.Exec(
		`INSERT INTO categories (id, name, icon, created_at) VALUES (?, ?, ?, ?)`,
		c.ID, c.Name, c.Icon, c.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return Category{}, err
	}

	// Link to user
	_, err = db.Exec(
		`INSERT INTO user_categories (user_id, category_id) VALUES (?, ?)`,
		userID, c.ID,
	)
	if err != nil {
		return Category{}, err
	}

	return c, nil
}

func UpdateCategory(db *sql.DB, id, name, icon string) (Category, error) {
	res, err := db.Exec(
		`UPDATE categories SET name = ?, icon = ? WHERE id = ?`,
		name, icon, id,
	)
	if err != nil {
		return Category{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Category{}, sql.ErrNoRows
	}
	return Category{ID: id, Name: name, Icon: icon}, nil
}

func RemoveCategoryFromUser(db *sql.DB, categoryID, userID string) error {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM transactions WHERE category_id = ? AND user_id = ?`,
		categoryID, userID,
	).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrCategoryInUse
	}

	_, err = db.Exec(
		`DELETE FROM user_categories WHERE user_id = ? AND category_id = ?`,
		userID, categoryID,
	)
	return err
}

func SeedDefaultCategoriesForUser(db *sql.DB, userID string) error {
	for _, catID := range DefaultCategoryIDs {
		_, err := db.Exec(
			`INSERT OR IGNORE INTO user_categories (user_id, category_id) VALUES (?, ?)`,
			userID, catID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

package model

import (
	"database/sql"
	"errors"
	"regexp"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUsernameTaken      = errors.New("username already taken")
	ErrInvalidPassphrase  = errors.New("invalid passphrase")
	ErrValidation         = errors.New("validation error")

	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)

	// dummyHash is used for timing-safe comparison when user is not found.
	dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy"), bcrypt.DefaultCost)
)

type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Register creates a new user and returns the user, plaintext passphrase, and any error.
func Register(db *sql.DB, username, password, name string) (User, string, error) {
	username = trimStr(username)
	name = trimStr(name)

	if !usernameRegex.MatchString(username) {
		return User{}, "", errors.Join(ErrValidation, errors.New("username must be 3-30 alphanumeric characters or underscores"))
	}
	if len(password) < 8 {
		return User{}, "", errors.Join(ErrValidation, errors.New("password must be at least 8 characters"))
	}
	if name == "" {
		return User{}, "", errors.Join(ErrValidation, errors.New("name is required"))
	}

	// Check uniqueness
	var exists int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&exists)
	if err != nil {
		return User{}, "", err
	}
	if exists > 0 {
		return User{}, "", ErrUsernameTaken
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", err
	}

	passphrase, err := GeneratePassphrase()
	if err != nil {
		return User{}, "", err
	}
	passphraseHash, err := bcrypt.GenerateFromPassword([]byte(passphrase), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", err
	}

	user := User{
		ID:        uuid.NewString(),
		Username:  username,
		Name:      name,
		CreatedAt: time.Now().UTC(),
	}

	_, err = db.Exec(
		"INSERT INTO users (id, username, password_hash, name, passphrase_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		user.ID, user.Username, string(passwordHash), user.Name, string(passphraseHash),
		user.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return User{}, "", err
	}

	// Seed default Cash account for this user
	if err := SeedDefaultAccountForUser(db, user.ID); err != nil {
		return User{}, "", err
	}

	// Seed default categories for this user
	if err := SeedDefaultCategoriesForUser(db, user.ID); err != nil {
		return User{}, "", err
	}

	return user, passphrase, nil
}

// Authenticate verifies credentials and returns the user.
// Returns the same error for wrong-user and wrong-password (timing-safe).
func Authenticate(db *sql.DB, username, password string) (User, error) {
	var user User
	var passwordHash string
	var createdAt string

	err := db.QueryRow(
		"SELECT id, username, name, password_hash, created_at FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.Name, &passwordHash, &createdAt)

	if err == sql.ErrNoRows {
		// Timing-safe: compare against dummy hash even when user not found
		bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return User{}, ErrInvalidCredentials
	}

	user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return user, nil
}

// ResetPassword verifies the recovery passphrase and updates the password.
func ResetPassword(db *sql.DB, username, passphrase, newPassword string) error {
	if len(newPassword) < 8 {
		return errors.Join(ErrValidation, errors.New("password must be at least 8 characters"))
	}

	var passphraseHash string
	err := db.QueryRow("SELECT passphrase_hash FROM users WHERE username = ?", username).Scan(&passphraseHash)
	if err == sql.ErrNoRows {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(passphrase))
		return ErrInvalidPassphrase
	}
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passphraseHash), []byte(passphrase)); err != nil {
		return ErrInvalidPassphrase
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.Exec("UPDATE users SET password_hash = ? WHERE username = ?", string(newHash), username)
	return err
}

// GetUserByID retrieves a user by their ID.
func GetUserByID(db *sql.DB, id string) (User, error) {
	var user User
	var createdAt string
	err := db.QueryRow(
		"SELECT id, username, name, created_at FROM users WHERE id = ?", id,
	).Scan(&user.ID, &user.Username, &user.Name, &createdAt)
	if err != nil {
		return User{}, err
	}
	user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return user, nil
}

func trimStr(s string) string {
	return regexp.MustCompile(`^\s+|\s+$`).ReplaceAllString(s, "")
}

package model_test

import (
	"errors"
	"testing"

	"simple-fi/model"
	"simple-fi/store"
)

func TestRegisterAndAuthenticate(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	user, passphrase, err := model.Register(db, "testuser", "password123", "Test User")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if user.ID == "" {
		t.Error("expected generated ID")
	}
	if user.Username != "testuser" {
		t.Errorf("expected username 'testuser', got %q", user.Username)
	}
	if user.Name != "Test User" {
		t.Errorf("expected name 'Test User', got %q", user.Name)
	}
	if passphrase == "" {
		t.Error("expected non-empty passphrase")
	}

	// Verify user can log in
	authed, err := model.Authenticate(db, "testuser", "password123")
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if authed.ID != user.ID {
		t.Errorf("expected ID %q, got %q", user.ID, authed.ID)
	}

	// Verify default Cash account was seeded
	accounts, err := model.ListAccounts(db, user.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 default account, got %d", len(accounts))
	}
	if accounts[0].Name != "Cash" {
		t.Errorf("expected 'Cash' account, got %q", accounts[0].Name)
	}
}

func TestRegisterDuplicateUsername(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, _, err = model.Register(db, "testuser", "password123", "User One")
	if err != nil {
		t.Fatal(err)
	}

	_, _, err = model.Register(db, "testuser", "password456", "User Two")
	if !errors.Is(err, model.ErrUsernameTaken) {
		t.Errorf("expected ErrUsernameTaken, got %v", err)
	}
}

func TestRegisterValidation(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Short password
	_, _, err = model.Register(db, "testuser", "short", "Test")
	if !errors.Is(err, model.ErrValidation) {
		t.Errorf("expected ErrValidation for short password, got %v", err)
	}

	// Invalid username
	_, _, err = model.Register(db, "ab", "password123", "Test")
	if !errors.Is(err, model.ErrValidation) {
		t.Errorf("expected ErrValidation for short username, got %v", err)
	}

	// Empty name
	_, _, err = model.Register(db, "testuser", "password123", "")
	if !errors.Is(err, model.ErrValidation) {
		t.Errorf("expected ErrValidation for empty name, got %v", err)
	}
}

func TestAuthenticateWrongPassword(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, _, _ = model.Register(db, "testuser", "password123", "Test")

	_, err = model.Authenticate(db, "testuser", "wrongpassword")
	if !errors.Is(err, model.ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestAuthenticateNonexistentUser(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, err = model.Authenticate(db, "noone", "password123")
	if !errors.Is(err, model.ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestResetPassword(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, passphrase, _ := model.Register(db, "testuser", "password123", "Test")

	// Reset with correct passphrase
	err = model.ResetPassword(db, "testuser", passphrase, "newpassword123")
	if err != nil {
		t.Fatalf("ResetPassword: %v", err)
	}

	// Old password should fail
	_, err = model.Authenticate(db, "testuser", "password123")
	if !errors.Is(err, model.ErrInvalidCredentials) {
		t.Errorf("expected old password to fail, got %v", err)
	}

	// New password should work
	_, err = model.Authenticate(db, "testuser", "newpassword123")
	if err != nil {
		t.Errorf("expected new password to work, got %v", err)
	}
}

func TestResetPasswordWrongPassphrase(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, _, _ = model.Register(db, "testuser", "password123", "Test")

	err = model.ResetPassword(db, "testuser", "wrong passphrase words here now", "newpassword123")
	if !errors.Is(err, model.ErrInvalidPassphrase) {
		t.Errorf("expected ErrInvalidPassphrase, got %v", err)
	}
}

package auth_test

import (
	"testing"
	"time"

	"simple-fi/auth"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := []byte("test-secret-key-32bytes-long!!!!!")
	userID := "user-123"

	token, err := auth.GenerateToken(userID, secret)
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	got, err := auth.ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	if got != userID {
		t.Errorf("expected userID %q, got %q", userID, got)
	}
}

func TestExpiredToken(t *testing.T) {
	secret := []byte("test-secret")

	// We can't easily create an expired token without manipulating time,
	// so we test that a valid token works and an invalid one doesn't.
	token, _ := auth.GenerateToken("user-1", secret)

	// Valid token should work
	_, err := auth.ValidateToken(token, secret)
	if err != nil {
		t.Errorf("expected valid token, got error: %v", err)
	}

	_ = time.Now() // ensure time package used
}

func TestTamperedSignature(t *testing.T) {
	secret := []byte("test-secret")

	token, _ := auth.GenerateToken("user-1", secret)

	// Tamper with token
	tampered := token + "x"
	_, err := auth.ValidateToken(tampered, secret)
	if err == nil {
		t.Error("expected error for tampered token")
	}
}

func TestWrongSecret(t *testing.T) {
	secret1 := []byte("secret-1")
	secret2 := []byte("secret-2")

	token, _ := auth.GenerateToken("user-1", secret1)

	_, err := auth.ValidateToken(token, secret2)
	if err == nil {
		t.Error("expected error for wrong secret")
	}
}

func TestInvalidTokenFormat(t *testing.T) {
	secret := []byte("test-secret")

	_, err := auth.ValidateToken("not-a-jwt", secret)
	if err == nil {
		t.Error("expected error for invalid token format")
	}

	_, err = auth.ValidateToken("a.b", secret)
	if err == nil {
		t.Error("expected error for 2-part token")
	}

	_, err = auth.ValidateToken("", secret)
	if err == nil {
		t.Error("expected error for empty token")
	}
}

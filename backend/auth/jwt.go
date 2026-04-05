package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
)

const tokenExpiry = 7 * 24 * time.Hour

type header struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

type payload struct {
	Sub string `json:"sub"`
	Exp int64  `json:"exp"`
	Iat int64  `json:"iat"`
}

// LoadOrGenerateSecret reads JWT_SECRET from env or generates a random 32-byte secret.
func LoadOrGenerateSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		log.Fatalf("failed to generate JWT secret: %v", err)
	}
	log.Println("WARNING: JWT_SECRET not set, using random secret (tokens will not survive restarts)")
	return secret
}

// GenerateToken creates an HS256 JWT for the given user ID.
func GenerateToken(userID string, secret []byte) (string, error) {
	h := header{Alg: "HS256", Typ: "JWT"}
	p := payload{
		Sub: userID,
		Iat: time.Now().Unix(),
		Exp: time.Now().Add(tokenExpiry).Unix(),
	}

	hJSON, _ := json.Marshal(h)
	pJSON, _ := json.Marshal(p)

	hEnc := base64URLEncode(hJSON)
	pEnc := base64URLEncode(pJSON)

	sigInput := hEnc + "." + pEnc
	sig := sign([]byte(sigInput), secret)
	sigEnc := base64URLEncode(sig)

	return fmt.Sprintf("%s.%s.%s", hEnc, pEnc, sigEnc), nil
}

// ValidateToken verifies an HS256 JWT and returns the user ID (sub claim).
func ValidateToken(tokenStr string, secret []byte) (string, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", ErrInvalidToken
	}

	sigInput := parts[0] + "." + parts[1]
	expectedSig := sign([]byte(sigInput), secret)
	actualSig, err := base64URLDecode(parts[2])
	if err != nil {
		return "", ErrInvalidToken
	}

	if !hmac.Equal(expectedSig, actualSig) {
		return "", ErrInvalidToken
	}

	pJSON, err := base64URLDecode(parts[1])
	if err != nil {
		return "", ErrInvalidToken
	}

	var p payload
	if err := json.Unmarshal(pJSON, &p); err != nil {
		return "", ErrInvalidToken
	}

	if time.Now().Unix() > p.Exp {
		return "", ErrExpiredToken
	}

	if p.Sub == "" {
		return "", ErrInvalidToken
	}

	return p.Sub, nil
}

func sign(data, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write(data)
	return mac.Sum(nil)
}

func base64URLEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

func base64URLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

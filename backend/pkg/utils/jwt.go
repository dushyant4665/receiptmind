package utils

import (
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateTokenPair(userID, role, privateKey string) (string, string, error) {
	key, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", "", err
	}

	access := jwt.NewWithClaims(jwt.SigningMethodRS256, Claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			Issuer:    "receiptmind-enterprise",
			Audience:  []string{"receiptmind-web"},
		},
	})

	refresh := jwt.NewWithClaims(jwt.SigningMethodRS256, Claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			Issuer:    "receiptmind-enterprise",
			Audience:  []string{"receiptmind-web"},
		},
	})

	accessToken, err := access.SignedString(key)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := refresh.SignedString(key)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func ParseToken(token, publicKey string) (*Claims, error) {
	key, err := parseRSAPublicKey(publicKey)
	if err != nil {
		return nil, err
	}

	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodRS256 {
			return nil, errors.New("unexpected signing method")
		}
		return key, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid claims")
	}

	return claims, nil
}

func parseRSAPrivateKey(encoded string) (*rsa.PrivateKey, error) {
	normalized := strings.ReplaceAll(encoded, "\\n", "\n")
	if strings.Contains(normalized, "BEGIN") {
		return jwt.ParseRSAPrivateKeyFromPEM([]byte(normalized))
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	return jwt.ParseRSAPrivateKeyFromPEM(raw)
}

func parseRSAPublicKey(encoded string) (*rsa.PublicKey, error) {
	normalized := strings.ReplaceAll(encoded, "\\n", "\n")
	if strings.Contains(normalized, "BEGIN") {
		return jwt.ParseRSAPublicKeyFromPEM([]byte(normalized))
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	return jwt.ParseRSAPublicKeyFromPEM(raw)
}

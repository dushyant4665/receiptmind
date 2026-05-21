package services

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"receiptmind-backend/internal/config"
)

type JWTService struct {
	config *config.Config
}

func NewJWTService(cfg *config.Config) *JWTService {
	return &JWTService{config: cfg}
}

type TokenClaims struct {
	UserID         string `json:"user_id"`
	OrganizationID string `json:"organization_id"`
	jwt.RegisteredClaims
}

func (s *JWTService) GenerateAccessToken(userID, organizationID string) (string, error) {
	claims := TokenClaims{
		UserID:         userID,
		OrganizationID: organizationID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.AccessTokenExpiry())),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "receiptmind",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *JWTService) GenerateRefreshToken(userID string) (string, error) {
	claims := TokenClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.RefreshTokenExpiry())),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "receiptmind",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *JWTService) ValidateToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}



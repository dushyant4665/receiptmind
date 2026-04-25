package handlers

import (
	"database/sql"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
	"github.com/receiptmind/backend/internal/services"
)

type AuthHandler struct {
	db    *database.PostgresDB
	auth  *services.AuthService
	cache *cache.RedisCache
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"`
	User         models.User `json:"user"`
}

func NewAuthHandler(db *database.PostgresDB, auth *services.AuthService, cacheClient *cache.RedisCache) *AuthHandler {
	return &AuthHandler{db: db, auth: auth, cache: cacheClient}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required fields"})
	}

	var exists bool
	err := h.db.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
		strings.ToLower(req.Email),
	).Scan(&exists)
	if err != nil {
		log.Printf("Database error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal server error"})
	}
	if exists {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "User already exists"})
	}

	hashedPassword, err := h.auth.HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	userID := uuid.New()
	_, err = h.db.DB.Exec(
		`INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
		userID, strings.ToLower(req.Email), hashedPassword, req.Name, "user",
	)
	if err != nil {
		log.Printf("Failed to create user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	var user models.User
	err = h.db.DB.QueryRow(
		`SELECT id, email, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.AvatarURL, &user.CompanyName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get user"})
	}

	accessToken, err := h.auth.GenerateAccessToken(user.ID.String(), user.Email, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate access token"})
	}

	refreshToken, err := h.auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	tokenHash, _ := h.auth.HashPassword(refreshToken)
	refreshExpiry, _ := time.ParseDuration(os.Getenv("JWT_REFRESH_EXPIRY"))
	if refreshExpiry == 0 {
		refreshExpiry = 7 * 24 * time.Hour
	}
	expiresAt := time.Now().Add(refreshExpiry)
	sessionID := uuid.New()
	_, err = h.db.DB.Exec(
		`INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		sessionID, user.ID, tokenHash, expiresAt, c.IP(), c.Get("User-Agent"),
	)
	if err != nil {
		log.Printf("Failed to store session: %v", err)
	}
	if h.cache != nil {
		_ = h.cache.SetUserSession(user.ID.String(), sessionID.String(), refreshExpiry)
	}

	return c.Status(fiber.StatusCreated).JSON(AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900,
		User:         user,
	})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var user models.User
	var passwordHash string
	err := h.db.DB.QueryRow(
		`SELECT id, email, password_hash, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at
		 FROM users WHERE email = $1`,
		strings.ToLower(req.Email),
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.Role, &user.AvatarURL, &user.CompanyName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal server error"})
	}

	if !h.auth.CheckPasswordHash(req.Password, passwordHash) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	accessToken, err := h.auth.GenerateAccessToken(user.ID.String(), user.Email, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate access token"})
	}
	refreshToken, err := h.auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	tokenHash, _ := h.auth.HashPassword(refreshToken)
	refreshExpiry, _ := time.ParseDuration(os.Getenv("JWT_REFRESH_EXPIRY"))
	if refreshExpiry == 0 {
		refreshExpiry = 7 * 24 * time.Hour
	}
	expiresAt := time.Now().Add(refreshExpiry)
	sessionID := uuid.New()
	_, _ = h.db.DB.Exec(
		`INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		sessionID, user.ID, tokenHash, expiresAt, c.IP(), c.Get("User-Agent"),
	)
	if h.cache != nil {
		_ = h.cache.SetUserSession(user.ID.String(), sessionID.String(), refreshExpiry)
	}

	return c.JSON(AuthResponse{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: 900, User: user})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "refresh_token is required"})
	}

	rows, err := h.db.DB.Query(`SELECT id, user_id, token_hash, expires_at FROM sessions WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal server error"})
	}
	defer rows.Close()

	var matchedSessionID uuid.UUID
	var matchedUserID uuid.UUID
	var matched bool
	for rows.Next() {
		var sid uuid.UUID
		var uid uuid.UUID
		var tokenHash string
		var expiresAt time.Time
		if err := rows.Scan(&sid, &uid, &tokenHash, &expiresAt); err != nil {
			continue
		}
		if h.auth.CheckPasswordHash(req.RefreshToken, tokenHash) {
			matchedSessionID = sid
			matchedUserID = uid
			matched = true
			break
		}
	}
	if !matched {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid refresh token"})
	}

	var user models.User
	err = h.db.DB.QueryRow(
		`SELECT id, email, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at FROM users WHERE id = $1`,
		matchedUserID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.AvatarURL, &user.CompanyName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	accessToken, err := h.auth.GenerateAccessToken(user.ID.String(), user.Email, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate access token"})
	}

	newRefreshToken, err := h.auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}
	newHash, _ := h.auth.HashPassword(newRefreshToken)
	refreshExpiry, _ := time.ParseDuration(os.Getenv("JWT_REFRESH_EXPIRY"))
	if refreshExpiry == 0 {
		refreshExpiry = 7 * 24 * time.Hour
	}
	newExpiresAt := time.Now().Add(refreshExpiry)
	_, _ = h.db.DB.Exec(`UPDATE sessions SET token_hash = $1, expires_at = $2 WHERE id = $3`, newHash, newExpiresAt, matchedSessionID)

	return c.JSON(AuthResponse{AccessToken: accessToken, RefreshToken: newRefreshToken, ExpiresIn: 900, User: user})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req RefreshRequest
	_ = c.BodyParser(&req)
	if req.RefreshToken == "" {
		return c.JSON(fiber.Map{"success": true})
	}

	rows, err := h.db.DB.Query(`SELECT id, user_id, token_hash FROM sessions WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		return c.JSON(fiber.Map{"success": true})
	}
	defer rows.Close()

	for rows.Next() {
		var sid uuid.UUID
		var uid uuid.UUID
		var tokenHash string
		if err := rows.Scan(&sid, &uid, &tokenHash); err != nil {
			continue
		}
		if h.auth.CheckPasswordHash(req.RefreshToken, tokenHash) {
			_, _ = h.db.DB.Exec(`DELETE FROM sessions WHERE id = $1`, sid)
			if h.cache != nil {
				_ = h.cache.DeleteUserSessions(uid.String())
			}
			break
		}
	}

	return c.JSON(fiber.Map{"success": true})
}

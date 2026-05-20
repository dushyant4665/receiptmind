package handlers

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
	"receiptmind-backend/pkg/utils"
)

type AuthHandler struct {
	DB         *database.Database
	JWTService *services.JWTService
	Config     *config.Config
}

func NewAuthHandler(db *database.Database, jwtService *services.JWTService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{DB: db, JWTService: jwtService, Config: cfg}
}

type RegisterRequest struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	OrganizationName string `json:"organization_name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.OrganizationName == "" {
		req.OrganizationName = "My Workspace"
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") || req.Password == "" {
		return SendError(c, fiber.StatusBadRequest, "valid email and password are required")
	}

	if len(req.Password) < 8 {
		return SendError(c, fiber.StatusBadRequest, "password must be at least 8 characters")
	}

	ctx := context.Background()

	var existingID string
	err := h.DB.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingID)
	if err == nil {
		return SendError(c, fiber.StatusConflict, "email already exists")
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback(ctx)

	orgID := uuid.New().String()
	slug := utils.GenerateSlug(req.OrganizationName) + "-" + strings.ToLower(uuid.New().String()[:4])
	_, err = tx.Exec(ctx, "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", orgID, req.OrganizationName, slug)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to create organization")
	}

	userID := uuid.New().String()
	_, err = tx.Exec(ctx,
		"INSERT INTO users (id, email, password_hash, organization_id, status, email_verified_at) VALUES ($1, $2, $3, $4, 'active', NOW())",
		userID, req.Email, hashedPassword, orgID,
	)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to create user")
	}

	if err := tx.Commit(ctx); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to commit transaction")
	}

	user := models.User{ID: userID, Email: req.Email, OrganizationID: orgID}
	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return SendError(c, fiber.StatusBadRequest, "email and password are required")
	}

	ctx := context.Background()

	var user models.User
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, organization_id FROM users WHERE email = $1",
		strings.ToLower(strings.TrimSpace(req.Email)),
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.OrganizationID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if !utils.CheckPassword(user.PasswordHash, req.Password) {
		return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	return c.JSON(SuccessResponse(fiber.Map{"message": "If this email exists, a reset link was sent (simulation)."}))
}

func (h *AuthHandler) createSessionResponse(c *fiber.Ctx, ctx context.Context, user models.User) error {
	accessToken, err := h.JWTService.GenerateAccessToken(user.ID, user.OrganizationID)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to generate token")
	}

	refreshToken, err := h.JWTService.GenerateRefreshToken(user.ID)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to generate refresh token")
	}

	sessionID := uuid.New().String()
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO sessions (id, user_id, refresh_token, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
		sessionID, user.ID, refreshToken, c.IP(), c.Get("User-Agent"),
	)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to create session")
	}

	return c.JSON(SuccessResponse(models.AuthResponse{
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
		User:           user.ToResponse(),
		OrganizationID: user.OrganizationID,
	}))
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}
	if req.RefreshToken == "" {
		return SendError(c, fiber.StatusBadRequest, "refresh_token is required")
	}

	claims, err := h.JWTService.ValidateToken(req.RefreshToken)
	if err != nil {
		return SendError(c, fiber.StatusUnauthorized, "invalid refresh token")
	}

	ctx := context.Background()
	var user models.User
	var sessionID string
	err = h.DB.Pool.QueryRow(ctx,
		`SELECT s.id, u.id, u.email, u.organization_id
		 FROM sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.user_id = $1 AND s.refresh_token = $2 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
		claims.UserID, req.RefreshToken,
	).Scan(&sessionID, &user.ID, &user.Email, &user.OrganizationID)
	if err != nil {
		return SendError(c, fiber.StatusUnauthorized, "session expired or invalid")
	}

	_, _ = h.DB.Pool.Exec(ctx, "UPDATE sessions SET revoked_at = NOW() WHERE id = $1", sessionID)
	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	return c.JSON(SuccessResponse(fiber.Map{"logged_out": true}))
}

func (h *AuthHandler) LogoutAll(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	_, _ = h.DB.Pool.Exec(context.Background(), "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1", userID)
	return c.JSON(SuccessResponse(fiber.Map{"logged_out_all": true}))
}

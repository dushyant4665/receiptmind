package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

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
	DB           *database.Database
	JWTService   *services.JWTService
	EmailService *services.EmailService
	Config       *config.Config
}

func NewAuthHandler(db *database.Database, jwtService *services.JWTService, emailService *services.EmailService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{DB: db, JWTService: jwtService, EmailService: emailService, Config: cfg}
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

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type VerifyEmailRequest struct {
	Token string `json:"token"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
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

	var existingUser models.User
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id FROM users WHERE email = $1", req.Email,
	).Scan(&existingUser.ID)
	if err == nil {
		return SendError(c, fiber.StatusConflict, "email already exists")
	}
	if err != pgx.ErrNoRows {
		log.Error().Err(err).Msg("Failed to check existing user")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin transaction")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer tx.Rollback(ctx)

	orgID := uuid.New().String()
	slug := utils.GenerateSlug(req.OrganizationName) + "-" + strings.ToLower(uuid.New().String()[:4])
	_, err = tx.Exec(ctx,
		"INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
		orgID, req.OrganizationName, slug,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create organization")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	userID := uuid.New().String()
	_, err = tx.Exec(ctx,
		"INSERT INTO users (id, email, password_hash, organization_id, status) VALUES ($1, $2, $3, $4, 'pending_verification')",
		userID, req.Email, hashedPassword, orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create user")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	token, tokenHash, err := services.GenerateSecureToken()
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate verification token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	_, err = tx.Exec(ctx,
		"INSERT INTO verification_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
		uuid.New().String(), userID, tokenHash, time.Now().Add(15*time.Minute),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create verification token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.Config.AppURL, "/"), token)
	if err := h.EmailService.SendVerification(context.Background(), req.Email, verifyURL); err != nil {
		log.Error().Err(err).Msg("Failed to send verification email")
	}

	user := models.User{ID: userID, Email: req.Email, OrganizationID: orgID}
	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(models.AuthResponse{
		AccessToken:    "",
		RefreshToken:   "",
		User:           user.ToResponse(),
		OrganizationID: orgID,
	}))
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
	var emailVerifiedAt *time.Time
	var userStatus string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, organization_id, email_verified_at, status FROM users WHERE email = $1",
		strings.ToLower(strings.TrimSpace(req.Email)),
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.OrganizationID, &emailVerifiedAt, &userStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
		}
		log.Error().Err(err).Msg("Failed to find user")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if !utils.CheckPassword(user.PasswordHash, req.Password) {
		return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
	}
	if emailVerifiedAt == nil || userStatus != "active" {
		return SendError(c, fiber.StatusForbidden, "Please verify your email.")
	}

	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) createSessionResponse(c *fiber.Ctx, ctx context.Context, user models.User) error {
	accessToken, err := h.JWTService.GenerateAccessToken(user.ID, user.OrganizationID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate access token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	refreshToken, err := h.JWTService.GenerateRefreshToken(user.ID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate refresh token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	sessionID := uuid.New().String()
	refreshHash := services.HashToken(refreshToken)
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO sessions (id, user_id, refresh_token, refresh_token_hash, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')`,
		sessionID, user.ID, refreshToken, refreshHash, c.IP(), c.Get("User-Agent"),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create session")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	return c.JSON(SuccessResponse(models.AuthResponse{
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
		User:           user.ToResponse(),
		OrganizationID: user.OrganizationID,
	}))
}

func (h *AuthHandler) VerifyEmail(c *fiber.Ctx) error {
	var req VerifyEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}
	if req.Token == "" {
		req.Token = c.Query("token")
	}
	if req.Token == "" {
		return SendError(c, fiber.StatusBadRequest, "token is required")
	}

	ctx := context.Background()
	tokenHash := services.HashToken(req.Token)
	var user models.User
	var tokenID string
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT vt.id, u.id, u.email, u.organization_id
		 FROM verification_tokens vt
		 JOIN users u ON u.id = vt.user_id
		 WHERE vt.token_hash = $1 AND vt.used_at IS NULL AND vt.expires_at > NOW()`,
		tokenHash,
	).Scan(&tokenID, &user.ID, &user.Email, &user.OrganizationID)
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid or expired verification link")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, "UPDATE verification_tokens SET used_at = NOW() WHERE id = $1", tokenID); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	if _, err = tx.Exec(ctx, "UPDATE users SET email_verified_at = NOW(), status = 'active' WHERE id = $1", user.ID); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	if err = tx.Commit(ctx); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	_ = h.EmailService.SendWelcome(context.Background(), user.Email, strings.TrimRight(h.Config.AppURL, "/")+"/dashboard")
	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) ResendVerification(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return SendError(c, fiber.StatusBadRequest, "email is required")
	}

	ctx := context.Background()
	var userID string
	var verified *time.Time
	err := h.DB.Pool.QueryRow(ctx, "SELECT id, email_verified_at FROM users WHERE email = $1", email).Scan(&userID, &verified)
	if err != nil || verified != nil {
		return c.JSON(SuccessResponse(fiber.Map{"sent": true}))
	}

	token, tokenHash, err := services.GenerateSecureToken()
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	_, _ = h.DB.Pool.Exec(ctx, "UPDATE verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", userID)
	_, err = h.DB.Pool.Exec(ctx, "INSERT INTO verification_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", uuid.New().String(), userID, tokenHash, time.Now().Add(15*time.Minute))
	if err == nil {
		_ = h.EmailService.SendVerification(context.Background(), email, strings.TrimRight(h.Config.AppURL, "/")+"/verify-email?token="+token)
	}
	return c.JSON(SuccessResponse(fiber.Map{"sent": true}))
}

func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return SendError(c, fiber.StatusBadRequest, "valid email is required")
	}

	ctx := context.Background()
	var userID string
	err := h.DB.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", req.Email).Scan(&userID)
	if err != nil && err != pgx.ErrNoRows {
		log.Error().Err(err).Msg("Failed to check forgot password email")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if err == nil {
		token, tokenHash, tokenErr := services.GenerateSecureToken()
		if tokenErr == nil {
			_, _ = h.DB.Pool.Exec(ctx, "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", userID)
			_, tokenErr = h.DB.Pool.Exec(ctx,
				"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
				uuid.New().String(), userID, tokenHash, time.Now().Add(15*time.Minute),
			)
		}
		if tokenErr == nil {
			resetURL := strings.TrimRight(h.Config.AppURL, "/") + "/reset-password?token=" + token
			if sendErr := h.EmailService.SendPasswordReset(context.Background(), req.Email, resetURL); sendErr != nil {
				log.Error().Err(sendErr).Msg("Failed to send password reset email")
			}
		}
		log.Info().Str("user_id", userID).Msg("Password reset requested")
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"sent": true,
	}))
}

func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}
	if req.Token == "" || len(req.NewPassword) < 8 {
		return SendError(c, fiber.StatusBadRequest, "token and 8+ character password are required")
	}

	ctx := context.Background()
	tokenHash := services.HashToken(req.Token)
	var tokenID, userID string
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT id, user_id FROM password_reset_tokens
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
		tokenHash,
	).Scan(&tokenID, &userID)
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid or expired reset link")
	}

	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", hash, userID); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	if _, err = tx.Exec(ctx, "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", tokenID); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	if _, err = tx.Exec(ctx, "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", userID); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	if err = tx.Commit(ctx); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	return c.JSON(SuccessResponse(fiber.Map{"reset": true}))
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
	hash := services.HashToken(req.RefreshToken)
	var user models.User
	var sessionID string
	err = h.DB.Pool.QueryRow(ctx,
		`SELECT s.id, u.id, u.email, u.organization_id
		 FROM sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.user_id = $1
		   AND COALESCE(s.refresh_token_hash, s.refresh_token) IN ($2, $3)
		   AND s.revoked_at IS NULL
		   AND s.expires_at > NOW()
		   AND u.status = 'active'
		   AND u.email_verified_at IS NOT NULL
		 ORDER BY s.expires_at DESC LIMIT 1`,
		claims.UserID, hash, req.RefreshToken,
	).Scan(&sessionID, &user.ID, &user.Email, &user.OrganizationID)
	if err != nil {
		return SendError(c, fiber.StatusUnauthorized, "invalid refresh token")
	}

	_, _ = h.DB.Pool.Exec(ctx, "UPDATE sessions SET revoked_at = NOW() WHERE id = $1", sessionID)
	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req RefreshRequest
	_ = c.BodyParser(&req)
	if req.RefreshToken != "" {
		_, _ = h.DB.Pool.Exec(context.Background(),
			"UPDATE sessions SET revoked_at = NOW() WHERE COALESCE(refresh_token_hash, refresh_token) IN ($1, $2)",
			services.HashToken(req.RefreshToken), req.RefreshToken,
		)
	}
	return c.JSON(SuccessResponse(fiber.Map{"logged_out": true}))
}

func (h *AuthHandler) LogoutAll(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	_, _ = h.DB.Pool.Exec(context.Background(), "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", userID)
	return c.JSON(SuccessResponse(fiber.Map{"logged_out_all": true}))
}

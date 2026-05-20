package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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

	// Check if user already exists in permanent table
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

	// Generate verification token
	token := uuid.New().String()
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Save to pending_registrations (upsert if already exists)
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO pending_registrations (id, email, password_hash, organization_name, token_hash, expires_at) 
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (email) DO UPDATE SET 
		 password_hash = EXCLUDED.password_hash, 
		 organization_name = EXCLUDED.organization_name, 
		 token_hash = EXCLUDED.token_hash, 
		 expires_at = EXCLUDED.expires_at`,
		uuid.New().String(), req.Email, hashedPassword, req.OrganizationName, tokenHash, time.Now().Add(24*time.Hour),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save pending registration")
		return SendError(c, fiber.StatusInternalServerError, "failed to initiate registration")
	}

	// Send verification email (not in goroutine to ensure it finishes or errors)
	err = h.EmailService.SendVerificationEmail(req.Email, token)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("CRITICAL: Failed to send verification email during signup")
		return SendError(c, fiber.StatusInternalServerError, "failed to send verification email, please try again")
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"message": "Registration initiated. Please check your email to verify and complete your account setup.",
		"email":   req.Email,
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
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, organization_id, status FROM users WHERE email = $1",
		strings.ToLower(strings.TrimSpace(req.Email)),
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.OrganizationID, &user.Status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if user.Status != "active" {
		return SendError(c, fiber.StatusForbidden, "Please verify your email address before logging in.")
	}

	if !utils.CheckPassword(user.PasswordHash, req.Password) {
		return SendError(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	return h.createSessionResponse(c, ctx, user)
}

func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	type ForgotRequest struct {
		Email string `json:"email"`
	}
	var req ForgotRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" {
		return SendError(c, fiber.StatusBadRequest, "email is required")
	}

	ctx := context.Background()
	var userID string
	err := h.DB.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", strings.ToLower(strings.TrimSpace(req.Email))).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Don't reveal if email exists
			return c.JSON(SuccessResponse(fiber.Map{"message": "If this email exists, a reset link was sent."}))
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	// Generate reset token
	token := uuid.New().String()
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	_, err = h.DB.Pool.Exec(ctx,
		"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
		uuid.New().String(), userID, tokenHash, time.Now().Add(1*time.Hour),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create password reset token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	// Send reset email
	go func() {
		if err := h.EmailService.SendPasswordResetEmail(req.Email, token); err != nil {
			log.Error().Err(err).Msg("Failed to send password reset email")
		}
	}()

	return c.JSON(SuccessResponse(fiber.Map{"message": "If this email exists, a reset link was sent."}))
}

func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	type ResetRequest struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	var req ResetRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Token == "" || req.NewPassword == "" {
		return SendError(c, fiber.StatusBadRequest, "token and new password are required")
	}

	if len(req.NewPassword) < 8 {
		return SendError(c, fiber.StatusBadRequest, "password must be at least 8 characters")
	}

	hash := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(hash[:])

	ctx := context.Background()
	var userID string
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT user_id FROM password_reset_tokens 
		 WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
		tokenHash,
	).Scan(&userID)

	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusBadRequest, "invalid or expired token")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to hash password")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback(ctx)

	// Update password
	_, err = tx.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", hashedPassword, userID)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to update password")
	}

	// Mark token as used
	_, err = tx.Exec(ctx, "UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1", tokenHash)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to update token")
	}

	if err := tx.Commit(ctx); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to commit transaction")
	}

	return c.JSON(SuccessResponse(fiber.Map{"message": "Password updated successfully. You can now log in."}))
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

func (h *AuthHandler) VerifyEmail(c *fiber.Ctx) error {
	type VerifyRequest struct {
		Token string `json:"token"`
	}
	var req VerifyRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Token == "" {
		return SendError(c, fiber.StatusBadRequest, "token is required")
	}

	hash := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(hash[:])

	ctx := context.Background()
	var pending struct {
		Email            string
		PasswordHash     string
		OrganizationName string
	}

	err := h.DB.Pool.QueryRow(ctx,
		`SELECT email, password_hash, organization_name FROM pending_registrations 
		 WHERE token_hash = $1 AND expires_at > NOW()`,
		tokenHash,
	).Scan(&pending.Email, &pending.PasswordHash, &pending.OrganizationName)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Warn().Str("token_hash", tokenHash).Msg("Invalid or expired verification token used")
			return SendError(c, fiber.StatusBadRequest, "invalid or expired token")
		}
		log.Error().Err(err).Msg("Failed to query pending registrations")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback(ctx)

	// Create Organization
	orgID := uuid.New().String()
	slug := utils.GenerateSlug(pending.OrganizationName) + "-" + strings.ToLower(uuid.New().String()[:4])
	_, err = tx.Exec(ctx, "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", orgID, pending.OrganizationName, slug)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create organization during verification")
		return SendError(c, fiber.StatusInternalServerError, "failed to create organization")
	}

	// Create User
	userID := uuid.New().String()
	_, err = tx.Exec(ctx,
		"INSERT INTO users (id, email, password_hash, organization_id, status, email_verified_at) VALUES ($1, $2, $3, $4, 'active', NOW())",
		userID, pending.Email, pending.PasswordHash, orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create user during verification")
		return SendError(c, fiber.StatusInternalServerError, "failed to create user")
	}

	// Delete pending registration
	_, err = tx.Exec(ctx, "DELETE FROM pending_registrations WHERE email = $1", pending.Email)
	if err != nil {
		log.Error().Err(err).Msg("Failed to delete pending registration after verification")
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit verification transaction")
		return SendError(c, fiber.StatusInternalServerError, "failed to finalize verification")
	}

	log.Info().Str("email", pending.Email).Msg("User verified and account created successfully")
	return c.JSON(SuccessResponse(fiber.Map{"verified": true, "message": "Email verified successfully. Your account is now active, you can log in."}))
}


func (h *AuthHandler) ResendVerification(c *fiber.Ctx) error {
	type ResendRequest struct {
		Email string `json:"email"`
	}
	var req ResendRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" {
		return SendError(c, fiber.StatusBadRequest, "email is required")
	}

	ctx := context.Background()
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Check if already active
	var status string
	err := h.DB.Pool.QueryRow(ctx, "SELECT status FROM users WHERE email = $1", req.Email).Scan(&status)
	if err == nil && status == "active" {
		return SendError(c, fiber.StatusBadRequest, "Email is already verified and account is active.")
	}

	// Find in pending
	var tokenHash string
	err = h.DB.Pool.QueryRow(ctx, "SELECT token_hash FROM pending_registrations WHERE email = $1", req.Email).Scan(&tokenHash)
	if err != nil {
		if err == pgx.ErrNoRows {
			return c.JSON(SuccessResponse(fiber.Map{"sent": true, "message": "If an account is pending, a verification email has been sent."}))
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	// Generate new verification token
	token := uuid.New().String()
	hash := sha256.Sum256([]byte(token))
	newTokenHash := hex.EncodeToString(hash[:])

	_, err = h.DB.Pool.Exec(ctx,
		"UPDATE pending_registrations SET token_hash = $1, expires_at = $2 WHERE email = $3",
		newTokenHash, time.Now().Add(24*time.Hour), req.Email,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update verification token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	// Send verification email
	err = h.EmailService.SendVerificationEmail(req.Email, token)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to resend verification email")
		return SendError(c, fiber.StatusInternalServerError, "failed to send email")
	}

	return c.JSON(SuccessResponse(fiber.Map{"sent": true, "message": "Verification email sent. Please check your inbox."}))
}


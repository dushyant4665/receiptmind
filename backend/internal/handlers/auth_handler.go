package handlers

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
	"receiptmind-backend/pkg/utils"
)

type AuthHandler struct {
	DB         *database.Database
	JWTService *services.JWTService
}

func NewAuthHandler(db *database.Database, jwtService *services.JWTService) *AuthHandler {
	return &AuthHandler{DB: db, JWTService: jwtService}
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

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.Password == "" || req.OrganizationName == "" {
		return SendError(c, fiber.StatusBadRequest, "email, password, and organization_name are required")
	}

	if len(req.Password) < 6 {
		return SendError(c, fiber.StatusBadRequest, "password must be at least 6 characters")
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
		"INSERT INTO users (id, email, password_hash, organization_id) VALUES ($1, $2, $3, $4)",
		userID, req.Email, hashedPassword, orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create user")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	accessToken, err := h.JWTService.GenerateAccessToken(userID, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate access token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	refreshToken, err := h.JWTService.GenerateRefreshToken(userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate refresh token")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	sessionID := uuid.New().String()
	_, err = tx.Exec(ctx,
		"INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')",
		sessionID, userID, refreshToken,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create session")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	user := models.User{
		ID:             userID,
		Email:          req.Email,
		OrganizationID: orgID,
	}

	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(models.AuthResponse{
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
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
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, organization_id FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.OrganizationID)
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
	_, err = h.DB.Pool.Exec(ctx,
		"INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')",
		sessionID, user.ID, refreshToken,
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

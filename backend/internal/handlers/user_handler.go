package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
)

type UserHandler struct {
	DB *database.Database
}

func NewUserHandler(db *database.Database) *UserHandler {
	return &UserHandler{DB: db}
}

type UpdateUserRequest struct {
	Name string `json:"name"`
}

func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	ctx := context.Background()

	var user models.User
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, email, name, organization_id, created_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.OrganizationID, &user.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "user not found")
		}
		log.Error().Err(err).Msg("Failed to fetch user")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	return c.JSON(SuccessResponse(user.ToResponse()))
}

func (h *UserHandler) UpdateMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	ctx := context.Background()
	_, err := h.DB.Pool.Exec(ctx,
		"UPDATE users SET name = $1 WHERE id = $2",
		req.Name, userID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update user")
		return SendError(c, fiber.StatusInternalServerError, "failed to update profile")
	}

	return h.GetMe(c)
}

package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
)

type UserHandler struct {
	db *database.PostgresDB
}

func NewUserHandler(db *database.PostgresDB) *UserHandler {
	return &UserHandler{db: db}
}

func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var user models.User
	err := h.db.DB.QueryRow(
		`SELECT id, email, COALESCE(name,''), COALESCE(role,'user'), COALESCE(avatar_url,''), COALESCE(company_name,''), created_at, updated_at FROM users WHERE id=$1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.AvatarURL, &user.CompanyName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch user"})
	}
	return c.JSON(user)
}

func (h *UserHandler) UpdateMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var req struct {
		Name        string `json:"name"`
		AvatarURL   string `json:"avatar_url"`
		CompanyName string `json:"company_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	_, err := h.db.DB.Exec(
		`UPDATE users SET name=$1, avatar_url=$2, company_name=$3, updated_at=NOW() WHERE id=$4`,
		strings.TrimSpace(req.Name), strings.TrimSpace(req.AvatarURL), strings.TrimSpace(req.CompanyName), userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return h.GetMe(c)
}

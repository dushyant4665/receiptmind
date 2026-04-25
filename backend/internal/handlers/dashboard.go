package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/receiptmind/backend/internal/database"
)

type DashboardHandler struct {
	db *database.PostgresDB
}

func NewDashboardHandler(db *database.PostgresDB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) Stats(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var totalSpent float64
	var receiptCount int
	var expenseCount int

	_ = h.db.DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1`, userID).Scan(&totalSpent)
	_ = h.db.DB.QueryRow(`SELECT COUNT(*) FROM receipts WHERE user_id = $1`, userID).Scan(&receiptCount)
	_ = h.db.DB.QueryRow(`SELECT COUNT(*) FROM expenses WHERE user_id = $1`, userID).Scan(&expenseCount)

	return c.JSON(fiber.Map{
		"total_spent":      totalSpent,
		"receipt_count":    receiptCount,
		"expense_count":    expenseCount,
		"monthly_change":   12.5,
		"accuracy_rate":    99.2,
		"time_saved_hours": 8.5,
	})
}

func (h *DashboardHandler) Activity(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	receiptsRows, _ := h.db.DB.Query(
		`SELECT id::text, filename, created_at FROM receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`,
		userID,
	)
	defer func() {
		if receiptsRows != nil {
			receiptsRows.Close()
		}
	}()

	activity := make([]fiber.Map, 0)
	if receiptsRows != nil {
		for receiptsRows.Next() {
			var id, filename string
			var createdAt string
			_ = receiptsRows.Scan(&id, &filename, &createdAt)
			activity = append(activity, fiber.Map{"type": "receipt", "id": id, "label": filename, "created_at": createdAt})
		}
	}

	return c.JSON(activity)
}

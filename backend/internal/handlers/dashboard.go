package handlers

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/receiptmind/backend/internal/database"
)

type DashboardHandler struct {
	db       *database.PostgresDB
	cache    cacheStore
	cacheTTL time.Duration
}

func NewDashboardHandler(db *database.PostgresDB, cacheClient cacheStore, cacheTTL time.Duration) *DashboardHandler {
	return &DashboardHandler{db: db, cache: normalizeCacheStore(cacheClient), cacheTTL: cacheTTL}
}

func (h *DashboardHandler) Stats(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	cacheKey := "dashboard:" + userID + ":stats"

	if h.cache != nil {
		cached, err := h.cache.Get(cacheKey)
		if err == nil {
			c.Set("X-Cache", "HIT")
			c.Type("json")
			return c.SendString(cached)
		}
	}

	var totalSpent float64
	var receiptCount int
	var expenseCount int

	_ = h.db.DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1`, userID).Scan(&totalSpent)
	_ = h.db.DB.QueryRow(`SELECT COUNT(*) FROM receipts WHERE user_id = $1`, userID).Scan(&receiptCount)
	_ = h.db.DB.QueryRow(`SELECT COUNT(*) FROM expenses WHERE user_id = $1`, userID).Scan(&expenseCount)

	payload := fiber.Map{
		"total_spent":   totalSpent,
		"receipt_count": receiptCount,
		"expense_count": expenseCount,
	}
	if h.cache != nil {
		_ = h.cache.SetJSON(cacheKey, payload, h.cacheTTL)
	}
	c.Set("X-Cache", "MISS")
	return c.JSON(payload)
}

func (h *DashboardHandler) Activity(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	cacheKey := "dashboard:" + userID + ":activity"

	if h.cache != nil {
		cached, err := h.cache.Get(cacheKey)
		if err == nil {
			c.Set("X-Cache", "HIT")
			c.Type("json")
			return c.SendString(cached)
		}
	}

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

	if h.cache != nil {
		raw, err := json.Marshal(activity)
		if err == nil {
			_ = h.cache.Set(cacheKey, raw, h.cacheTTL)
		}
	}
	c.Set("X-Cache", "MISS")
	return c.JSON(activity)
}

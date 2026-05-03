package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
)

type DashboardHandler struct {
	DB    *database.Database
	Redis *redis.Client
}

func NewDashboardHandler(db *database.Database, redisClient *redis.Client) *DashboardHandler {
	return &DashboardHandler{DB: db, Redis: redisClient}
}

type DashboardStats struct {
	TotalReceipts   int     `json:"total_receipts"`
	TotalAmount     float64 `json:"total_amount"`
	ProcessedCount  int     `json:"processed_count"`
	PendingCount    int     `json:"pending_count"`
	NeedsReviewCount int    `json:"needs_review_count"`
}

func (h *DashboardHandler) GetStats(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()
	cacheKey := fmt.Sprintf("dashboard:%s", orgID)

	cached, err := h.Redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var stats DashboardStats
		if json.Unmarshal([]byte(cached), &stats) == nil {
			return c.JSON(SuccessResponse(stats))
		}
	}

	var stats DashboardStats

	err = h.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM receipts WHERE organization_id = $1",
		orgID,
	).Scan(&stats.TotalReceipts)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count total receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	err = h.DB.Pool.QueryRow(ctx,
		"SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE organization_id = $1 AND status = 'processed'",
		orgID,
	).Scan(&stats.TotalAmount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sum total amount")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	err = h.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM receipts WHERE organization_id = $1 AND status = 'processed'",
		orgID,
	).Scan(&stats.ProcessedCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count processed receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	err = h.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM receipts WHERE organization_id = $1 AND status IN ('pending', 'processing')",
		orgID,
	).Scan(&stats.PendingCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count pending receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	err = h.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM exceptions WHERE organization_id = $1 AND status = 'open'",
		orgID,
	).Scan(&stats.NeedsReviewCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count open exceptions")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	data, err := json.Marshal(stats)
	if err == nil {
		h.Redis.Set(ctx, cacheKey, data, 30*time.Second)
	}

	return c.JSON(SuccessResponse(stats))
}

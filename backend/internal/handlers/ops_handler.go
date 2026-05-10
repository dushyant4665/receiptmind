package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"receiptmind-backend/internal/database"
)

type OpsHandler struct {
	DB    *database.Database
	Redis *redis.Client
}

func NewOpsHandler(db *database.Database, redisClient *redis.Client) *OpsHandler {
	return &OpsHandler{DB: db, Redis: redisClient}
}

func (h *OpsHandler) Health(c *fiber.Ctx) error {
	ctx := context.Background()
	queueSize, _ := h.Redis.LLen(ctx, "receiptmind:jobs").Result()
	delayedQueueSize, _ := h.Redis.ZCard(ctx, "receiptmind:jobs:delayed").Result()
	deadLetterSize, _ := h.Redis.LLen(ctx, "receiptmind:dead_jobs").Result()

	var processing, retrying, failed int
	var avgLatencySeconds float64
	_ = h.DB.Pool.QueryRow(ctx,
		`SELECT
		 COUNT(*) FILTER (WHERE processing_state = 'processing'),
		 COUNT(*) FILTER (WHERE processing_state = 'retrying'),
		 COUNT(*) FILTER (WHERE processing_state = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'),
		 COALESCE(AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) FILTER (WHERE finished_at IS NOT NULL AND started_at IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'), 0)
		 FROM receipt_processing_jobs`,
	).Scan(&processing, &retrying, &failed, &avgLatencySeconds)

	status := "healthy"
	if deadLetterSize > 0 || failed > 10 {
		status = "degraded"
	}
	if queueSize > 1000 {
		status = "backlogged"
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"status":                 status,
		"queue_size":             queueSize,
		"delayed_queue_size":     delayedQueueSize,
		"dead_letter_size":       deadLetterSize,
		"processing_jobs":        processing,
		"retrying_jobs":          retrying,
		"failed_jobs_24h":        failed,
		"avg_processing_seconds": avgLatencySeconds,
		"checked_at":             time.Now().UTC().Format(time.RFC3339),
	}))
}

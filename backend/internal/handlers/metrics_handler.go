package handlers

import (
	"context"
	"sync/atomic"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"receiptmind-backend/internal/database"
)

type MetricsHandler struct {
	DB       *database.Database
	Redis    *redis.Client
	Requests int64
	Errors   int64
}

func NewMetricsHandler(db *database.Database, redisClient *redis.Client) *MetricsHandler {
	return &MetricsHandler{
		DB:    db,
		Redis: redisClient,
	}
}

func (m *MetricsHandler) IncrementRequests() {
	atomic.AddInt64(&m.Requests, 1)
}

func (m *MetricsHandler) IncrementErrors() {
	atomic.AddInt64(&m.Errors, 1)
}

func (m *MetricsHandler) GetMetrics(c *fiber.Ctx) error {
	ctx := context.Background()

	requests := atomic.LoadInt64(&m.Requests)
	errors := atomic.LoadInt64(&m.Errors)

	queueSize, _ := m.Redis.LLen(ctx, "receiptmind:jobs").Result()
	delayedQueueSize, _ := m.Redis.ZCard(ctx, "receiptmind:jobs:delayed").Result()
	deadLetterSize, _ := m.Redis.LLen(ctx, "receiptmind:dead_jobs").Result()

	errorRate := float64(0)
	if requests > 0 {
		errorRate = float64(errors) / float64(requests) * 100
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"request_count":      requests,
		"error_count":        errors,
		"error_rate_percent": errorRate,
		"job_queue_size":     queueSize,
		"delayed_queue_size": delayedQueueSize,
		"dead_letter_size":   deadLetterSize,
	}))
}

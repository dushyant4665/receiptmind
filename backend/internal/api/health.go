package api

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"receiptmind-backend/internal/db"
)

type HealthHandler struct {
	DB    *db.Database
	Redis *db.RedisClient
}

func NewHealthHandler(db *db.Database, redis *db.RedisClient) *HealthHandler {
	return &HealthHandler{DB: db, Redis: redis}
}

func (h *HealthHandler) Health(c *fiber.Ctx) error {
	ctx := context.Background()

	dbOK := true
	if err := h.DB.Health(ctx); err != nil {
		dbOK = false
	}

	redisOK := true
	if err := h.Redis.Client.Ping(ctx).Err(); err != nil {
		redisOK = false
	}

	if !dbOK || !redisOK {
		return c.Status(fiber.StatusServiceUnavailable).JSON(ErrorResponse("service degraded"))
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"status": "ok",
		"db":     "connected",
		"redis":  "connected",
	}))
}

func (h *HealthHandler) Ready(c *fiber.Ctx) error {
	ctx := context.Background()

	if err := h.DB.Health(ctx); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(ErrorResponse("database unreachable"))
	}

	if err := h.Redis.Client.Ping(ctx).Err(); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(ErrorResponse("redis unreachable"))
	}

	return c.JSON(SuccessResponse(fiber.Map{"status": "ready"}))
}



package middleware

import (
	"fmt"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"receiptmind-backend/internal/api"
)

func RateLimit(redisClient *redis.Client, prefix string, maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip rate limiting in development
		if os.Getenv("ENVIRONMENT") == "development" || os.Getenv("ENVIRONMENT") == "" {
			return c.Next()
		}

		ctx := c.Context()
		key := fmt.Sprintf("ratelimit:%s:%s", prefix, c.IP())

		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			return c.Next()
		}

		if count == 1 {
			redisClient.Expire(ctx, key, window)
		}

		if count > int64(maxRequests) {
			return c.Status(fiber.StatusTooManyRequests).JSON(api.ErrorResponse(
				fmt.Sprintf("rate limit exceeded: max %d requests per %v", maxRequests, window),
			))
		}

		c.Set("X-RateLimit-Limit", fmt.Sprintf("%d", maxRequests))
		c.Set("X-RateLimit-Remaining", fmt.Sprintf("%d", int64(maxRequests)-count))

		return c.Next()
	}
}



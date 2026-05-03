package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		err := c.Next()

		latency := time.Since(start)

		event := log.Info()
		if c.Response().StatusCode() >= 500 {
			event = log.Error()
		} else if c.Response().StatusCode() >= 400 {
			event = log.Warn()
		}

		logger := event.
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", c.Response().StatusCode()).
			Dur("latency", latency).
			Str("ip", c.IP())

		if requestID, ok := c.Locals("request_id").(string); ok && requestID != "" {
			logger = logger.Str("request_id", requestID)
		}
		if userID, ok := c.Locals("user_id").(string); ok && userID != "" {
			logger = logger.Str("user_id", userID)
		}
		if orgID, ok := c.Locals("organization_id").(string); ok && orgID != "" {
			logger = logger.Str("organization_id", orgID)
		}

		logger.Msg("Request")

		return err
	}
}

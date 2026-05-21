package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Get("X-Request-ID")
		if id == "" {
			id = uuid.New().String()
		}

		c.Set("X-Request-ID", id)
		c.Locals("request_id", id)

		return c.Next()
	}
}

func GetRequestID(c *fiber.Ctx) string {
	if id, ok := c.Locals("request_id").(string); ok {
		return id
	}
	return ""
}

func LoggerWithContext(c *fiber.Ctx) zerolog.Logger {
	return zerolog.Ctx(c.Context()).With().
		Str("request_id", GetRequestID(c)).
		Str("method", c.Method()).
		Str("path", c.Path()).
		Str("ip", c.IP()).
		Logger()
}



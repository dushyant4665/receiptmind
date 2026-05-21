package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

func RequestTimeout(d time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Request-Timeout", d.String())
		return c.Next()
	}
}



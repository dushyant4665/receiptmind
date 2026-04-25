package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type visitor struct {
	count     int
	expiresAt time.Time
}

var (
	visitors   = map[string]*visitor{}
	visitorsMu sync.Mutex
)

func NewRateLimiter() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		now := time.Now()

		visitorsMu.Lock()
		v, exists := visitors[ip]
		if !exists || now.After(v.expiresAt) {
			visitors[ip] = &visitor{count: 1, expiresAt: now.Add(time.Minute)}
			visitorsMu.Unlock()
			return c.Next()
		}

		if v.count >= 120 {
			visitorsMu.Unlock()
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "rate limit exceeded",
			})
		}

		v.count++
		visitorsMu.Unlock()
		return c.Next()
	}
}

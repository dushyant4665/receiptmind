package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"receiptmind-backend/internal/handlers"
	"receiptmind-backend/internal/services"
)

func AuthProtected(jwtService *services.JWTService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(handlers.ErrorResponse("missing authorization header"))
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(handlers.ErrorResponse("invalid authorization format"))
		}

		claims, err := jwtService.ValidateToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(handlers.ErrorResponse("invalid or expired token"))
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("organization_id", claims.OrganizationID)

		return c.Next()
	}
}

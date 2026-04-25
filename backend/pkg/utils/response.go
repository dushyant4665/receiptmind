package utils

import "github.com/gofiber/fiber/v2"

func JSON(c *fiber.Ctx, status int, message string, data interface{}) error {
	return c.Status(status).JSON(fiber.Map{
		"success": status < fiber.StatusBadRequest,
		"message": message,
		"data":    data,
	})
}

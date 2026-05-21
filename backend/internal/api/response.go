package api

import (
	"github.com/gofiber/fiber/v2"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func SuccessResponse(data interface{}) APIResponse {
	return APIResponse{
		Success: true,
		Data:    data,
	}
}

func ErrorResponse(err string) APIResponse {
	return APIResponse{
		Success: false,
		Error:   err,
	}
}

func SendSuccess(c *fiber.Ctx, data interface{}) error {
	return c.JSON(SuccessResponse(data))
}

func SendError(c *fiber.Ctx, status int, err string) error {
	return c.Status(status).JSON(ErrorResponse(err))
}



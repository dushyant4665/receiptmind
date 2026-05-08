package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"

	"receiptmind-backend/internal/config"
)

type IntegrationHandler struct {
	Config *config.Config
}

func NewIntegrationHandler(cfg *config.Config) *IntegrationHandler {
	return &IntegrationHandler{Config: cfg}
}

func (h *IntegrationHandler) Status(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	alias := orgID
	if len(alias) > 8 {
		alias = alias[:8]
	}
	inboxEmail := fmt.Sprintf("inbox+%s@receiptmind.app", alias)

	return c.JSON(SuccessResponse(fiber.Map{
		"email": fiber.Map{
			"enabled":       h.Config.EmailWebhookToken != "",
			"address":       inboxEmail,
			"webhook_route": "/email/webhook",
		},
		"google_sheets": fiber.Map{
			"enabled": h.Config.GoogleSheetsEnabled &&
				h.Config.GoogleSheetsSpreadsheetID != "" &&
				h.Config.GoogleSheetsAccessToken != "",
			"spreadsheet_id_set": h.Config.GoogleSheetsSpreadsheetID != "",
		},
	}))
}

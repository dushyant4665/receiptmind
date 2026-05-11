package handlers

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"

	"receiptmind-backend/internal/database"
)

type OnboardingHandler struct {
	DB *database.Database
}

func NewOnboardingHandler(db *database.Database) *OnboardingHandler {
	return &OnboardingHandler{DB: db}
}

type OnboardingStep struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
	Href        string `json:"href"`
}

func (h *OnboardingHandler) Status(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	userID := c.Locals("user_id").(string)
	ctx := context.Background()

	var emailVerified, googleConnected, hasReceipt, hasProcessed bool
	_ = h.DB.Pool.QueryRow(ctx, "SELECT email_verified_at IS NOT NULL FROM users WHERE id = $1", userID).Scan(&emailVerified)
	_ = h.DB.Pool.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM google_integrations
			WHERE organization_id = $1 AND status = 'connected' AND deleted_at IS NULL
		)`,
		orgID,
	).Scan(&googleConnected)
	_ = h.DB.Pool.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM receipts
			WHERE organization_id = $1 AND deleted_at IS NULL
		)`,
		orgID,
	).Scan(&hasReceipt)
	_ = h.DB.Pool.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM receipts
			WHERE organization_id = $1 AND status = 'processed' AND deleted_at IS NULL
		)`,
		orgID,
	).Scan(&hasProcessed)

	alias := orgID
	if len(alias) > 8 {
		alias = alias[:8]
	}
	forwardingEmail := fmt.Sprintf("inbox+%s@receiptmind.app", alias)
	steps := []OnboardingStep{
		{ID: "verify_email", Title: "Verify email", Description: "Secure the workspace before automation starts.", Done: emailVerified, Href: "/verify-email"},
		{ID: "connect_google", Title: "Connect Google Sheets", Description: "Create the accountant-ready spreadsheet automatically.", Done: googleConnected, Href: "/integrations"},
		{ID: "forwarding_email", Title: "Save forwarding email", Description: forwardingEmail, Done: true, Href: "/integrations"},
		{ID: "first_receipt", Title: "Upload or forward first receipt", Description: "Trigger the first automation run.", Done: hasReceipt, Href: "/receipts"},
		{ID: "first_processed", Title: "See first processed result", Description: "Confirm vendor, amount, date, and category.", Done: hasProcessed, Href: "/receipts"},
	}

	nextAction := fiber.Map{"label": "Open dashboard", "href": "/dashboard"}
	for _, step := range steps {
		if !step.Done {
			nextAction = fiber.Map{"label": step.Title, "href": step.Href}
			break
		}
	}

	completed := 0
	for _, step := range steps {
		if step.Done {
			completed++
		}
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"steps":            steps,
		"completed":        completed,
		"total":            len(steps),
		"forwarding_email": forwardingEmail,
		"next_action":      nextAction,
		"magic_moment":     hasProcessed && googleConnected,
	}))
}

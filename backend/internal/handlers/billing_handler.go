package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
)

type BillingHandler struct {
	DB     *database.Database
	Config *config.Config
}

func NewBillingHandler(db *database.Database, cfg *config.Config) *BillingHandler {
	return &BillingHandler{DB: db, Config: cfg}
}

type BillingStatus struct {
	Plan                 string `json:"plan"`
	ReceiptCountThisMonth int   `json:"receipt_count_this_month"`
	ReceiptLimit         int    `json:"receipt_limit"`
	CanUpload            bool   `json:"can_upload"`
	StripeCustomerID     string `json:"stripe_customer_id"`
	HasSubscription      bool   `json:"has_subscription"`
}

func (h *BillingHandler) GetStatus(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	ctx := context.Background()

	var count int
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM receipts
		 WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
		orgID,
	).Scan(&count)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count receipts for billing")
		count = 0
	}

	limit := h.Config.FreeReceiptLimit
	if limit <= 0 {
		limit = 50
	}

	status := BillingStatus{
		Plan:                 "free",
		ReceiptCountThisMonth: count,
		ReceiptLimit:         limit,
		CanUpload:            count < limit,
		StripeCustomerID:     "",
		HasSubscription:      false,
	}

	return c.JSON(SuccessResponse(status))
}

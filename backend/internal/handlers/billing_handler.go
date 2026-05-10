package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
)

type BillingHandler struct {
	DB     *database.Database
	Config *config.Config
}

func (h *BillingHandler) StripeWebhook(c *fiber.Ctx) error {
	if h.Config.StripeWebhookSecret != "" && c.Get("Stripe-Signature") == "" {
		return SendError(c, fiber.StatusUnauthorized, "missing stripe signature")
	}
	var event struct {
		Type string `json:"type"`
		Data struct {
			Object map[string]interface{} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(c.Body(), &event); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid stripe webhook")
	}
	if event.Type != "checkout.session.completed" && event.Type != "customer.subscription.updated" {
		return c.JSON(SuccessResponse(fiber.Map{"received": true}))
	}
	obj := event.Data.Object
	orgID := stringValue(obj["client_reference_id"])
	if orgID == "" {
		if metadata, ok := obj["metadata"].(map[string]interface{}); ok {
			orgID = stringValue(metadata["organization_id"])
		}
	}
	if orgID == "" {
		return c.JSON(SuccessResponse(fiber.Map{"received": true, "ignored": "missing organization"}))
	}
	customerID := stringValue(obj["customer"])
	subscriptionID := stringValue(obj["subscription"])
	plan := "pro"
	if metadata, ok := obj["metadata"].(map[string]interface{}); ok && stringValue(metadata["plan"]) != "" {
		plan = stringValue(metadata["plan"])
	}
	_, err := h.DB.Pool.Exec(context.Background(),
		`INSERT INTO subscriptions (id, organization_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, updated_at)
		 VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + INTERVAL '1 month', NOW())
		 ON CONFLICT (organization_id) WHERE deleted_at IS NULL
		 DO UPDATE SET plan = EXCLUDED.plan,
		               status = 'active',
		               stripe_customer_id = EXCLUDED.stripe_customer_id,
		               stripe_subscription_id = EXCLUDED.stripe_subscription_id,
		               current_period_end = EXCLUDED.current_period_end,
		               updated_at = NOW()`,
		uuid.NewString(), orgID, plan, customerID, subscriptionID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update subscription from Stripe webhook")
		return SendError(c, fiber.StatusInternalServerError, "failed to update subscription")
	}
	return c.JSON(SuccessResponse(fiber.Map{"received": true}))
}

func stringValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	default:
		return ""
	}
}

func NewBillingHandler(db *database.Database, cfg *config.Config) *BillingHandler {
	return &BillingHandler{DB: db, Config: cfg}
}

type BillingStatus struct {
	Plan                  string `json:"plan"`
	ReceiptCountThisMonth int    `json:"receipt_count_this_month"`
	ReceiptLimit          int    `json:"receipt_limit"`
	CanUpload             bool   `json:"can_upload"`
	StripeCustomerID      string `json:"stripe_customer_id"`
	HasSubscription       bool   `json:"has_subscription"`
}

type CheckoutRequest struct {
	Plan string `json:"plan"`
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
		Plan:                  "free",
		ReceiptCountThisMonth: count,
		ReceiptLimit:          limit,
		CanUpload:             count < limit,
		StripeCustomerID:      "",
		HasSubscription:       false,
	}
	_ = h.DB.Pool.QueryRow(ctx,
		`SELECT plan, COALESCE(stripe_customer_id, ''), status IN ('active', 'trialing')
		 FROM subscriptions
		 WHERE organization_id = $1 AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT 1`,
		orgID,
	).Scan(&status.Plan, &status.StripeCustomerID, &status.HasSubscription)
	if status.HasSubscription && status.Plan != "free" {
		status.ReceiptLimit = 0
		status.CanUpload = true
	}

	return c.JSON(SuccessResponse(status))
}

func (h *BillingHandler) CreateCheckout(c *fiber.Ctx) error {
	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	plan := strings.TrimSpace(req.Plan)
	if plan == "" {
		return SendError(c, fiber.StatusBadRequest, "plan is required")
	}

	allowedPlans := map[string]bool{
		"pro":         true,
		"team":        true,
		"pro_monthly": true,
		"pro_yearly":  true,
	}
	if !allowedPlans[plan] {
		return SendError(c, fiber.StatusBadRequest, "invalid plan")
	}

	if h.Config.StripeCheckoutURL != "" {
		checkoutURL, err := url.Parse(h.Config.StripeCheckoutURL)
		if err != nil {
			log.Error().Err(err).Msg("Invalid STRIPE_CHECKOUT_URL")
			return SendError(c, fiber.StatusInternalServerError, "checkout is misconfigured")
		}
		query := checkoutURL.Query()
		query.Set("plan", plan)
		checkoutURL.RawQuery = query.Encode()

		return c.JSON(SuccessResponse(fiber.Map{"url": checkoutURL.String()}))
	}

	if h.Config.StripeSecretKey == "" {
		return SendError(c, fiber.StatusServiceUnavailable, "checkout is not configured")
	}

	priceID := h.priceIDForPlan(plan)
	if priceID == "" {
		return SendError(c, fiber.StatusServiceUnavailable, "checkout price IDs are not configured")
	}

	orgID, _ := c.Locals("organization_id").(string)
	userID, _ := c.Locals("user_id").(string)
	checkout, err := h.createStripeCheckout(context.Background(), plan, priceID, orgID, userID)
	if err != nil {
		log.Error().Err(err).Msg("Stripe checkout creation failed")
		return SendError(c, fiber.StatusBadGateway, "failed to start checkout")
	}
	return c.JSON(SuccessResponse(fiber.Map{"url": checkout.URL}))
}

func (h *BillingHandler) priceIDForPlan(plan string) string {
	switch plan {
	case "team":
		return h.Config.StripeTeamPriceID
	default:
		return h.Config.StripeProPriceID
	}
}

type stripeCheckoutSession struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

func (h *BillingHandler) createStripeCheckout(ctx context.Context, plan, priceID, orgID, userID string) (*stripeCheckoutSession, error) {
	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("success_url", strings.TrimRight(h.Config.AppURL, "/")+"/settings/billing?checkout=success")
	form.Set("cancel_url", strings.TrimRight(h.Config.AppURL, "/")+"/settings/billing?checkout=cancelled")
	form.Set("client_reference_id", orgID)
	form.Set("metadata[organization_id]", orgID)
	form.Set("metadata[user_id]", userID)
	form.Set("metadata[plan]", plan)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(h.Config.StripeSecretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fiber.NewError(resp.StatusCode, string(body))
	}
	var session stripeCheckoutSession
	if err := json.Unmarshal(body, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

package handlers

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/checkout/session"
)

type StripeHandler struct{}

func NewStripeHandler() *StripeHandler {
	apiKey := os.Getenv("STRIPE_SECRET_KEY")
	if strings.TrimSpace(apiKey) != "" {
		stripe.Key = apiKey
	}
	return &StripeHandler{}
}

type CreateCheckoutRequest struct {
	Plan      string `json:"plan"`       // "pro_monthly", "pro_yearly"
	SuccessURL string `json:"success_url"`
	CancelURL  string `json:"cancel_url"`
}

func (h *StripeHandler) CreateCheckout(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	
	var req CreateCheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if stripe.Key == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Stripe not configured"})
	}

	// Get price IDs from env
	var priceID string
	switch req.Plan {
	case "pro_monthly":
		priceID = os.Getenv("STRIPE_PRICE_PRO_MONTHLY")
	case "pro_yearly":
		priceID = os.Getenv("STRIPE_PRICE_PRO_YEARLY")
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid plan"})
	}

	if priceID == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Price not configured"})
	}

	successURL := req.SuccessURL
	if successURL == "" {
		successURL = "http://localhost:3000/dashboard?checkout=success"
	}
	cancelURL := req.CancelURL
	if cancelURL == "" {
		cancelURL = "http://localhost:3000/pricing?checkout=cancelled"
	}

	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata: map[string]string{
			"user_id": userID,
		},
	}

	s, err := session.New(params)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"url":       s.URL,
		"session_id": s.ID,
	})
}

func (h *StripeHandler) Webhook(c *fiber.Ctx) error {
	// TODO: Implement webhook handler for subscription events
	return c.SendStatus(fiber.StatusOK)
}

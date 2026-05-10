package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
)

type RuleHandler struct {
	DB           *database.Database
	RuleService  *services.RuleService
	AuditService *services.AuditService
}

func NewRuleHandler(db *database.Database, ruleSvc *services.RuleService, auditSvc *services.AuditService) *RuleHandler {
	return &RuleHandler{
		DB:           db,
		RuleService:  ruleSvc,
		AuditService: auditSvc,
	}
}

func (h *RuleHandler) CreateRule(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	var req models.CreateRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.ConditionType == "" || req.ConditionValue == "" || req.ActionType == "" || req.ActionValue == "" {
		return SendError(c, fiber.StatusBadRequest, "all fields are required: condition_type, condition_value, action_type, action_value")
	}

	validConditionTypes := map[string]bool{"vendor": true, "category": true, "amount_range": true}
	if !validConditionTypes[req.ConditionType] {
		return SendError(c, fiber.StatusBadRequest, "invalid condition_type. allowed: vendor, category, amount_range")
	}

	validActionTypes := map[string]bool{"set_category": true, "ignore": true, "recurring": true}
	if !validActionTypes[req.ActionType] {
		return SendError(c, fiber.StatusBadRequest, "invalid action_type. allowed: set_category, ignore, recurring")
	}

	ctx := context.Background()

	rule, err := h.RuleService.Create(ctx, orgID, req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create rule")
		return SendError(c, fiber.StatusInternalServerError, "failed to create rule")
	}
	if h.AuditService != nil {
		userID := c.Locals("user_id").(string)
		h.AuditService.Log(ctx, orgID, userID, "rule.created", "rule", rule.ID, c.IP(), c.Get("User-Agent"), "{}")
	}

	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(rule))
}

func (h *RuleHandler) ListRules(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	rules, err := h.RuleService.GetByOrganization(ctx, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list rules")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	return c.JSON(SuccessResponse(rules))
}

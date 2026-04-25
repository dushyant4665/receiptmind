package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
)

type CategoryRulesHandler struct {
	db         *database.PostgresDB
	redisCache *cache.RedisCache
}

func NewCategoryRulesHandler(db *database.PostgresDB, redisCache *cache.RedisCache) *CategoryRulesHandler {
	return &CategoryRulesHandler{
		db:         db,
		redisCache: redisCache,
	}
}

type CreateRuleRequest struct {
	Name                         string   `json:"name" validate:"required,max=100"`
	Priority                     int      `json:"priority" validate:"min=0,max=1000"`
	ConditionVendor              string   `json:"condition_vendor,omitempty" validate:"omitempty,max=255"`
	ConditionAmountMin           *float64 `json:"condition_amount_min,omitempty"`
	ConditionAmountMax           *float64 `json:"condition_amount_max,omitempty"`
	ConditionDescriptionContains string   `json:"condition_description_contains,omitempty" validate:"omitempty,max=255"`
	ActionCategory               string   `json:"action_category" validate:"required,max=100"`
	ActionSubcategory            string   `json:"action_subcategory,omitempty" validate:"omitempty,max=100"`
	ActionTaxCode                string   `json:"action_tax_code,omitempty" validate:"omitempty,max=50"`
	ActionIsBillable             *bool    `json:"action_is_billable,omitempty"`
	ActionIsReimbursable         *bool    `json:"action_is_reimbursable,omitempty"`
	ActionNotes                  string   `json:"action_notes,omitempty" validate:"omitempty,max=500"`
}

type UpdateRuleRequest struct {
	Name                         string   `json:"name,omitempty" validate:"omitempty,max=100"`
	Priority                     *int     `json:"priority,omitempty" validate:"omitempty,min=0,max=1000"`
	ConditionVendor              string   `json:"condition_vendor,omitempty" validate:"omitempty,max=255"`
	ConditionAmountMin           *float64 `json:"condition_amount_min,omitempty"`
	ConditionAmountMax           *float64 `json:"condition_amount_max,omitempty"`
	ConditionDescriptionContains string   `json:"condition_description_contains,omitempty" validate:"omitempty,max=255"`
	ActionCategory               string   `json:"action_category,omitempty" validate:"omitempty,max=100"`
	ActionSubcategory            string   `json:"action_subcategory,omitempty" validate:"omitempty,max=100"`
	ActionTaxCode                string   `json:"action_tax_code,omitempty" validate:"omitempty,max=50"`
	ActionIsBillable             *bool    `json:"action_is_billable,omitempty"`
	ActionIsReimbursable         *bool    `json:"action_is_reimbursable,omitempty"`
	ActionNotes                  string   `json:"action_notes,omitempty" validate:"omitempty,max=500"`
	IsActive                     *bool    `json:"is_active,omitempty"`
}

type RuleApplicationResult struct {
	RuleID    uuid.UUID `json:"rule_id"`
	RuleName  string    `json:"rule_name"`
	AppliedAt time.Time `json:"applied_at"`
	FieldsSet []string  `json:"fields_set"`
}

const rulesCacheKey = "rules:user:%s"
const rulesCacheTTL = 5 * time.Minute

func (h *CategoryRulesHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	cacheKey := fmt.Sprintf(rulesCacheKey, userID)

	if h.redisCache != nil {
		cached, err := h.redisCache.Get(cacheKey)
		if err == nil && cached != "" {
			var rules []models.CategoryRule
			if err := json.Unmarshal([]byte(cached), &rules); err == nil {
				c.Set("X-Cache", "HIT")
				return c.JSON(fiber.Map{
					"rules": rules,
					"count": len(rules),
				})
			}
		}
	}

	query := `
		SELECT id, user_id, name, priority, condition_vendor, 
		       condition_amount_min, condition_amount_max, condition_description_contains,
		       action_category, action_subcategory, action_tax_code, 
		       action_is_billable, action_is_reimbursable, action_notes,
		       is_active, times_applied, created_at, updated_at
		FROM category_rules 
		WHERE user_id = $1 
		ORDER BY priority DESC, created_at DESC`

	rows, err := h.db.DB.Query(query, userID)
	if err != nil {
		log.Printf("Error listing rules: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list rules"})
	}
	defer rows.Close()

	var rules []models.CategoryRule
	for rows.Next() {
		var rule models.CategoryRule
		err := rows.Scan(
			&rule.ID, &rule.UserID, &rule.Name, &rule.Priority, &rule.ConditionVendor,
			&rule.ConditionAmountMin, &rule.ConditionAmountMax, &rule.ConditionDescriptionContains,
			&rule.ActionCategory, &rule.ActionSubcategory, &rule.ActionTaxCode,
			&rule.ActionIsBillable, &rule.ActionIsReimbursable, &rule.ActionNotes,
			&rule.IsActive, &rule.TimesApplied, &rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			continue
		}
		rules = append(rules, rule)
	}

	if h.redisCache != nil {
		if data, err := json.Marshal(rules); err == nil {
			_ = h.redisCache.Set(cacheKey, string(data), rulesCacheTTL)
		}
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(fiber.Map{
		"rules": rules,
		"count": len(rules),
	})
}

func (h *CategoryRulesHandler) Create(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req CreateRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Name == "" || req.ActionCategory == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and action_category are required"})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "invalid user id"})
	}

	ruleID := uuid.New()
	now := time.Now()

	query := `
		INSERT INTO category_rules (
			id, user_id, name, priority, condition_vendor, 
			condition_amount_min, condition_amount_max, condition_description_contains,
			action_category, action_subcategory, action_tax_code, 
			action_is_billable, action_is_reimbursable, action_notes,
			is_active, times_applied, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)`

	_, err = h.db.DB.Exec(query,
		ruleID, userUUID, req.Name, req.Priority, req.ConditionVendor,
		req.ConditionAmountMin, req.ConditionAmountMax, req.ConditionDescriptionContains,
		req.ActionCategory, req.ActionSubcategory, req.ActionTaxCode,
		req.ActionIsBillable, req.ActionIsReimbursable, req.ActionNotes,
		true, 0, now,
	)
	if err != nil {
		log.Printf("Error creating rule: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create rule"})
	}

	h.invalidateRulesCache(c.Context(), userID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":      ruleID,
		"message": "rule created successfully",
	})
}

func (h *CategoryRulesHandler) Get(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	ruleID := c.Params("id")
	if ruleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "rule id required"})
	}

	ruleUUID, err := uuid.Parse(ruleID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid rule id"})
	}

	userUUID, _ := uuid.Parse(userID)

	query := `
		SELECT id, user_id, name, priority, condition_vendor, 
		       condition_amount_min, condition_amount_max, condition_description_contains,
		       action_category, action_subcategory, action_tax_code, 
		       action_is_billable, action_is_reimbursable, action_notes,
		       is_active, times_applied, created_at, updated_at
		FROM category_rules 
		WHERE id = $1 AND user_id = $2`

	var rule models.CategoryRule
	err = h.db.DB.QueryRow(query, ruleUUID, userUUID).Scan(
		&rule.ID, &rule.UserID, &rule.Name, &rule.Priority, &rule.ConditionVendor,
		&rule.ConditionAmountMin, &rule.ConditionAmountMax, &rule.ConditionDescriptionContains,
		&rule.ActionCategory, &rule.ActionSubcategory, &rule.ActionTaxCode,
		&rule.ActionIsBillable, &rule.ActionIsReimbursable, &rule.ActionNotes,
		&rule.IsActive, &rule.TimesApplied, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "rule not found"})
	}
	if err != nil {
		log.Printf("Error getting rule: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get rule"})
	}

	return c.JSON(rule)
}

func (h *CategoryRulesHandler) Update(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	ruleID := c.Params("id")
	if ruleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "rule id required"})
	}

	ruleUUID, err := uuid.Parse(ruleID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid rule id"})
	}

	var req UpdateRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	userUUID, _ := uuid.Parse(userID)
	now := time.Now()

	query := `
		UPDATE category_rules SET
			name = COALESCE(NULLIF($3, ''), name),
			priority = COALESCE($4, priority),
			condition_vendor = COALESCE(NULLIF($5, ''), condition_vendor),
			condition_amount_min = COALESCE($6, condition_amount_min),
			condition_amount_max = COALESCE($7, condition_amount_max),
			condition_description_contains = COALESCE(NULLIF($8, ''), condition_description_contains),
			action_category = COALESCE(NULLIF($9, ''), action_category),
			action_subcategory = COALESCE(NULLIF($10, ''), action_subcategory),
			action_tax_code = COALESCE(NULLIF($11, ''), action_tax_code),
			action_is_billable = COALESCE($12, action_is_billable),
			action_is_reimbursable = COALESCE($13, action_is_reimbursable),
			action_notes = COALESCE(NULLIF($14, ''), action_notes),
			is_active = COALESCE($15, is_active),
			updated_at = $16
		WHERE id = $1 AND user_id = $2`

	_, err = h.db.DB.Exec(query,
		ruleUUID, userUUID, req.Name, req.Priority, req.ConditionVendor,
		req.ConditionAmountMin, req.ConditionAmountMax, req.ConditionDescriptionContains,
		req.ActionCategory, req.ActionSubcategory, req.ActionTaxCode,
		req.ActionIsBillable, req.ActionIsReimbursable, req.ActionNotes,
		req.IsActive, now,
	)
	if err != nil {
		log.Printf("Error updating rule: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update rule"})
	}

	h.invalidateRulesCache(c.Context(), userID)

	return c.JSON(fiber.Map{
		"id":      ruleID,
		"message": "rule updated successfully",
	})
}

func (h *CategoryRulesHandler) Delete(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	ruleID := c.Params("id")
	if ruleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "rule id required"})
	}

	ruleUUID, err := uuid.Parse(ruleID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid rule id"})
	}

	userUUID, _ := uuid.Parse(userID)

	query := `DELETE FROM category_rules WHERE id = $1 AND user_id = $2`
	result, err := h.db.DB.Exec(query, ruleUUID, userUUID)
	if err != nil {
		log.Printf("Error deleting rule: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete rule"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "rule not found"})
	}

	h.invalidateRulesCache(c.Context(), userID)

	return c.JSON(fiber.Map{
		"id":      ruleID,
		"message": "rule deleted successfully",
	})
}

func (h *CategoryRulesHandler) Apply(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	receiptID := c.Params("receipt_id")
	if receiptID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "receipt id required"})
	}

	receiptUUID, err := uuid.Parse(receiptID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid receipt id"})
	}

	userUUID, _ := uuid.Parse(userID)

	var vendorName string
	var amount float64
	var description string

	receiptQuery := `SELECT vendor_name, amount, description FROM receipts WHERE id = $1 AND user_id = $2`
	err = h.db.DB.QueryRow(receiptQuery, receiptUUID, userUUID).Scan(&vendorName, &amount, &description)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "receipt not found"})
	}
	if err != nil {
		log.Printf("Error fetching receipt for rule apply: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch receipt"})
	}

	appliedRule, err := h.applyRules(c.Context(), userUUID, receiptUUID, vendorName, amount, description)
	if err != nil {
		log.Printf("Error applying rules: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to apply rules"})
	}

	return c.JSON(fiber.Map{
		"receipt_id":                receiptID,
		"rule_applied":              appliedRule != nil,
		"rule":                      appliedRule,
		"categorization_confidence": 1.0,
	})
}

func (h *CategoryRulesHandler) applyRules(ctx context.Context, userID, receiptID uuid.UUID, vendorName string, amount float64, description string) (*RuleApplicationResult, error) {
	query := `
		SELECT id, name, priority, condition_vendor, 
		       condition_amount_min, condition_amount_max, condition_description_contains,
		       action_category, action_subcategory, action_tax_code, 
		       action_is_billable, action_is_reimbursable, action_notes
		FROM category_rules 
		WHERE user_id = $1 AND is_active = true
		ORDER BY priority DESC, created_at ASC`

	rows, err := h.db.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule models.CategoryRule
		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Priority, &rule.ConditionVendor,
			&rule.ConditionAmountMin, &rule.ConditionAmountMax, &rule.ConditionDescriptionContains,
			&rule.ActionCategory, &rule.ActionSubcategory, &rule.ActionTaxCode,
			&rule.ActionIsBillable, &rule.ActionIsReimbursable, &rule.ActionNotes,
		)
		if err != nil {
			continue
		}

		if h.matchesRule(&rule, vendorName, amount, description) {
			fieldsSet := h.applyRuleToReceipt(ctx, receiptID, &rule)
			h.incrementRuleUsage(ctx, rule.ID)

			return &RuleApplicationResult{
				RuleID:    rule.ID,
				RuleName:  rule.Name,
				AppliedAt: time.Now(),
				FieldsSet: fieldsSet,
			}, nil
		}
	}

	return nil, nil
}

func (h *CategoryRulesHandler) matchesRule(rule *models.CategoryRule, vendorName string, amount float64, description string) bool {
	if rule.ConditionVendor != "" && vendorName != "" {
		if !containsIgnoreCase(vendorName, rule.ConditionVendor) {
			return false
		}
	}

	if rule.ConditionAmountMin != nil && amount < *rule.ConditionAmountMin {
		return false
	}

	if rule.ConditionAmountMax != nil && amount > *rule.ConditionAmountMax {
		return false
	}

	if rule.ConditionDescriptionContains != "" && description != "" {
		if !containsIgnoreCase(description, rule.ConditionDescriptionContains) {
			return false
		}
	}

	return rule.ConditionVendor != "" || rule.ConditionAmountMin != nil ||
		rule.ConditionAmountMax != nil || rule.ConditionDescriptionContains != ""
}

func (h *CategoryRulesHandler) applyRuleToReceipt(ctx context.Context, receiptID uuid.UUID, rule *models.CategoryRule) []string {
	fields := []string{"category"}

	updateQuery := `
		UPDATE receipts SET 
			category = $2,
			status = 'categorized',
			processed_at = NOW()
		WHERE id = $1`

	_, err := h.db.DB.Exec(updateQuery, receiptID, rule.ActionCategory)
	if err != nil {
		log.Printf("Error applying rule to receipt: %v", err)
		return nil
	}

	if rule.ActionSubcategory != "" {
		fields = append(fields, "subcategory")
	}
	if rule.ActionTaxCode != "" {
		fields = append(fields, "tax_code")
	}
	if rule.ActionIsBillable != nil {
		fields = append(fields, "is_billable")
	}
	if rule.ActionIsReimbursable != nil {
		fields = append(fields, "is_reimbursable")
	}

	return fields
}

func (h *CategoryRulesHandler) incrementRuleUsage(ctx context.Context, ruleID uuid.UUID) {
	query := `UPDATE category_rules SET times_applied = times_applied + 1 WHERE id = $1`
	_, _ = h.db.DB.Exec(query, ruleID)
}

func (h *CategoryRulesHandler) invalidateRulesCache(ctx context.Context, userID string) {
	if h.redisCache != nil {
		cacheKey := fmt.Sprintf(rulesCacheKey, userID)
		_ = h.redisCache.Delete(cacheKey)
	}
}

func containsIgnoreCase(s, substr string) bool {
	return len(substr) <= len(s) &&
		(s == substr ||
			len(s) > 0 && len(substr) > 0 &&
				containsFold(s, substr))
}

func containsFold(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if equalFold(s[i:i+len(substr)], substr) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		if toLower(a[i]) != toLower(b[i]) {
			return false
		}
	}
	return true
}

func toLower(c byte) byte {
	if c >= 'A' && c <= 'Z' {
		return c + ('a' - 'A')
	}
	return c
}

package services

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
)

type RuleService struct {
	db *database.Database
}

func NewRuleService(db *database.Database) *RuleService {
	return &RuleService{db: db}
}

func (r *RuleService) ApplyRules(ctx context.Context, orgID string, extraction *ExtractionResult) *ExtractionResult {
	rules, err := r.GetActiveByOrganization(ctx, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch rules for applying")
		return extraction
	}

	result := *extraction

	normalizedVendor := normalizeVendor(extraction.VendorName)
	if normalizedVendor != "" {
		var canonical string
		err := r.db.Pool.QueryRow(ctx,
			`SELECT canonical_vendor FROM vendor_aliases
			 WHERE organization_id = $1 AND normalized_alias = $2 AND deleted_at IS NULL
			 ORDER BY confidence DESC LIMIT 1`,
			orgID, normalizedVendor,
		).Scan(&canonical)
		if err == nil && canonical != "" {
			result.VendorName = canonical
		}
	}

	for _, rule := range rules {
		matched := false

		switch rule.ConditionType {
		case "vendor":
			matched = normalizeVendor(result.VendorName) == normalizeVendor(rule.ConditionValue)
		case "category":
			matched = result.Category == rule.ConditionValue
		}

		if !matched {
			continue
		}

		switch rule.ActionType {
		case "set_category":
			result.Category = rule.ActionValue
			log.Info().
				Str("rule_id", rule.ID).
				Str("vendor", result.VendorName).
				Str("category", rule.ActionValue).
				Msg("Rule applied: category override")
		case "ignore":
			log.Info().Str("rule_id", rule.ID).Msg("Rule applied: ignore")
		case "recurring":
			log.Info().Str("rule_id", rule.ID).Msg("Rule applied: recurring flag")
		}
	}

	return &result
}

func (r *RuleService) GetActiveByOrganization(ctx context.Context, orgID string) ([]models.Rule, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, condition_type, condition_value, action_type, action_value, is_active, created_at
		 FROM rules WHERE organization_id = $1 AND is_active = true
		 ORDER BY created_at DESC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch rules: %w", err)
	}
	defer rows.Close()

	rules := make([]models.Rule, 0)
	for rows.Next() {
		var rule models.Rule
		if err := rows.Scan(&rule.ID, &rule.OrganizationID, &rule.ConditionType, &rule.ConditionValue, &rule.ActionType, &rule.ActionValue, &rule.IsActive, &rule.CreatedAt); err != nil {
			log.Error().Err(err).Msg("Failed to scan rule")
			continue
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *RuleService) Create(ctx context.Context, orgID string, req models.CreateRuleRequest) (*models.Rule, error) {
	rule := &models.Rule{
		ID:             uuid.New().String(),
		OrganizationID: orgID,
		ConditionType:  req.ConditionType,
		ConditionValue: req.ConditionValue,
		ActionType:     req.ActionType,
		ActionValue:    req.ActionValue,
		IsActive:       true,
	}

	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		rule.ID, rule.OrganizationID, rule.ConditionType, rule.ConditionValue, rule.ActionType, rule.ActionValue, rule.IsActive,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create rule: %w", err)
	}

	log.Info().Str("rule_id", rule.ID).Str("condition", rule.ConditionValue).Msg("Rule created")
	return rule, nil
}

func (r *RuleService) GetByOrganization(ctx context.Context, orgID string) ([]models.Rule, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, condition_type, condition_value, action_type, action_value, is_active, created_at
		 FROM rules WHERE organization_id = $1
		 ORDER BY created_at DESC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch rules: %w", err)
	}
	defer rows.Close()

	rules := make([]models.Rule, 0)
	for rows.Next() {
		var rule models.Rule
		if err := rows.Scan(&rule.ID, &rule.OrganizationID, &rule.ConditionType, &rule.ConditionValue, &rule.ActionType, &rule.ActionValue, &rule.IsActive, &rule.CreatedAt); err != nil {
			continue
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *RuleService) AutoLearnFromEdit(ctx context.Context, orgID, vendorName, newCategory string) {
	// Record the learning event
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO rule_learning_events (id, organization_id, vendor, chosen_category)
		 VALUES ($1, $2, $3, $4)`,
		uuid.New().String(), orgID, vendorName, newCategory,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to record learning event")
		return
	}

	// Count learning events for this vendor+category combo
	var eventCount int
	err = r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM rule_learning_events
		 WHERE organization_id = $1 AND vendor = $2 AND chosen_category = $3`,
		orgID, vendorName, newCategory,
	).Scan(&eventCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count learning events")
		return
	}

	if eventCount >= 3 {
		normalized := normalizeVendor(vendorName)
		if normalized != "" {
			_, _ = r.db.Pool.Exec(ctx,
				`INSERT INTO vendor_aliases (id, organization_id, canonical_vendor, alias, normalized_alias, confidence)
				 VALUES ($1, $2, $3, $4, $5, 0.92)
				 ON CONFLICT (organization_id, normalized_alias)
				 DO UPDATE SET canonical_vendor = EXCLUDED.canonical_vendor, confidence = GREATEST(vendor_aliases.confidence, EXCLUDED.confidence), updated_at = NOW()`,
				uuid.NewString(), orgID, vendorName, vendorName, normalized,
			)
		}

		// Check if rule already exists
		var existingID string
		err := r.db.Pool.QueryRow(ctx,
			`SELECT id FROM rules
			 WHERE organization_id = $1 AND condition_type = 'vendor' AND condition_value = $2 AND action_type = 'set_category'`,
			orgID, vendorName,
		).Scan(&existingID)

		if err == nil {
			// Rule exists, update it
			_, _ = r.db.Pool.Exec(ctx,
				`UPDATE rules SET action_value = $1 WHERE id = $2`,
				newCategory, existingID,
			)
			log.Info().Str("vendor", vendorName).Str("category", newCategory).Msg("Auto-learned rule updated")
			return
		}

		// Create new rule
		_, err = r.db.Pool.Exec(ctx,
			`INSERT INTO rules (id, organization_id, condition_type, condition_value, action_type, action_value, is_active)
			 VALUES ($1, $2, 'vendor', $3, 'set_category', $4, true)`,
			uuid.New().String(), orgID, vendorName, newCategory,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to auto-create rule")
			return
		}

		log.Info().
			Str("vendor", vendorName).
			Str("category", newCategory).
			Int("events", eventCount).
			Msg("Auto-learned rule created from learning events")
	}
}

var nonVendorChars = regexp.MustCompile(`[^a-z0-9]+`)

func normalizeVendor(vendor string) string {
	vendor = strings.ToLower(strings.TrimSpace(vendor))
	replacements := map[string]string{
		"amazon web services": "aws",
		"amzn aws":            "aws",
		"amazon aws":          "aws",
	}
	if replacement, ok := replacements[vendor]; ok {
		vendor = replacement
	}
	vendor = nonVendorChars.ReplaceAllString(vendor, " ")
	return strings.Join(strings.Fields(vendor), " ")
}

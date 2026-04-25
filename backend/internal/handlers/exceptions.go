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

type ExceptionsHandler struct {
	db         *database.PostgresDB
	redisCache *cache.RedisCache
}

func NewExceptionsHandler(db *database.PostgresDB, redisCache *cache.RedisCache) *ExceptionsHandler {
	return &ExceptionsHandler{
		db:         db,
		redisCache: redisCache,
	}
}

type CreateExceptionRequest struct {
	ReceiptID       string `json:"receipt_id,omitempty"`
	Type            string `json:"type" validate:"required,oneof=low_confidence duplicate_suspected amount_anomaly missing_date missing_vendor policy_violation unmatched_transaction missing_receipt"`
	Severity        string `json:"severity" validate:"omitempty,oneof=low medium high"`
	Description     string `json:"description" validate:"required,max=500"`
	SuggestedAction string `json:"suggested_action,omitempty" validate:"omitempty,max=255"`
}

type ResolveExceptionRequest struct {
	ResolutionNotes string `json:"resolution_notes,omitempty" validate:"omitempty,max=1000"`
}

type ExceptionListFilters struct {
	Type     string
	Status   string
	Severity string
	Limit    int
	Offset   int
}

const exceptionsCacheKey = "exceptions:user:%s:status:%s"
const exceptionCountCacheKey = "exceptions:count:user:%s"
const exceptionsCacheTTL = 2 * time.Minute

func (h *ExceptionsHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	filters := ExceptionListFilters{
		Type:     c.Query("type", ""),
		Status:   c.Query("status", "open"),
		Severity: c.Query("severity", ""),
		Limit:    c.QueryInt("limit", 50),
		Offset:   c.QueryInt("offset", 0),
	}

	if filters.Limit > 100 {
		filters.Limit = 100
	}

	cacheKey := fmt.Sprintf(exceptionsCacheKey, userID, filters.Status)

	if h.redisCache != nil && filters.Type == "" && filters.Severity == "" && filters.Offset == 0 {
		cached, err := h.redisCache.Get(cacheKey)
		if err == nil && cached != "" {
			var response fiber.Map
			if err := json.Unmarshal([]byte(cached), &response); err == nil {
				c.Set("X-Cache", "HIT")
				return c.JSON(response)
			}
		}
	}

	query := `
		SELECT e.id, e.user_id, e.receipt_id, e.type, e.severity, e.description, 
		       e.suggested_action, e.status, e.resolved_by, e.resolved_at, 
		       e.resolution_notes, e.created_at,
		       r.vendor_name, r.amount, r.receipt_date, r.file_url
		FROM exceptions e
		LEFT JOIN receipts r ON e.receipt_id = r.id
		WHERE e.user_id = $1`

	args := []interface{}{userID}
	argCount := 1

	if filters.Type != "" {
		argCount++
		query += fmt.Sprintf(" AND e.type = $%d", argCount)
		args = append(args, filters.Type)
	}

	if filters.Status != "" {
		argCount++
		query += fmt.Sprintf(" AND e.status = $%d", argCount)
		args = append(args, filters.Status)
	}

	if filters.Severity != "" {
		argCount++
		query += fmt.Sprintf(" AND e.severity = $%d", argCount)
		args = append(args, filters.Severity)
	}

	query += " ORDER BY e.created_at DESC"

	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, filters.Limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, filters.Offset)

	rows, err := h.db.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error listing exceptions: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list exceptions"})
	}
	defer rows.Close()

	var exceptions []fiber.Map
	for rows.Next() {
		var exc models.Exception
		var vendorName, fileURL string
		var amount float64
		var receiptDate *time.Time

		err := rows.Scan(
			&exc.ID, &exc.UserID, &exc.ReceiptID, &exc.Type, &exc.Severity, &exc.Description,
			&exc.SuggestedAction, &exc.Status, &exc.ResolvedBy, &exc.ResolvedAt,
			&exc.ResolutionNotes, &exc.CreatedAt,
			&vendorName, &amount, &receiptDate, &fileURL,
		)
		if err != nil {
			continue
		}

		excMap := fiber.Map{
			"id":               exc.ID,
			"type":             exc.Type,
			"type_label":       formatExceptionType(exc.Type),
			"severity":         exc.Severity,
			"description":      exc.Description,
			"suggested_action": exc.SuggestedAction,
			"status":           exc.Status,
			"created_at":       exc.CreatedAt,
		}

		if exc.ReceiptID != nil {
			excMap["receipt"] = fiber.Map{
				"id":           exc.ReceiptID,
				"vendor_name":  vendorName,
				"amount":       amount,
				"receipt_date": receiptDate,
				"thumbnail":    fileURL,
			}
		}

		exceptions = append(exceptions, excMap)
	}

	countQuery := `SELECT COUNT(*) FROM exceptions WHERE user_id = $1 AND status = 'open'`
	var openCount int
	_ = h.db.DB.QueryRow(countQuery, userID).Scan(&openCount)

	response := fiber.Map{
		"exceptions": exceptions,
		"count":      len(exceptions),
		"open_count": openCount,
		"filters":    filters,
	}

	if h.redisCache != nil && filters.Type == "" && filters.Severity == "" && filters.Offset == 0 {
		if data, err := json.Marshal(response); err == nil {
			_ = h.redisCache.Set(cacheKey, string(data), exceptionsCacheTTL)
		}
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(response)
}

func (h *ExceptionsHandler) Create(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req CreateExceptionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Type == "" || req.Description == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "type and description are required"})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "invalid user id"})
	}

	severity := req.Severity
	if severity == "" {
		severity = "medium"
	}

	excID := uuid.New()
	now := time.Now()

	var receiptUUID *uuid.UUID
	if req.ReceiptID != "" {
		rid, err := uuid.Parse(req.ReceiptID)
		if err == nil {
			receiptUUID = &rid
		}
	}

	query := `
		INSERT INTO exceptions (
			id, user_id, receipt_id, type, severity, description, 
			suggested_action, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err = h.db.DB.Exec(query,
		excID, userUUID, receiptUUID, req.Type, severity, req.Description,
		req.SuggestedAction, "open", now,
	)
	if err != nil {
		log.Printf("Error creating exception: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create exception"})
	}

	h.invalidateExceptionsCache(c.Context(), userID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":      excID,
		"message": "exception created successfully",
	})
}

func (h *ExceptionsHandler) Resolve(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	excID := c.Params("id")
	if excID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "exception id required"})
	}

	excUUID, err := uuid.Parse(excID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid exception id"})
	}

	var req ResolveExceptionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	userUUID, _ := uuid.Parse(userID)
	now := time.Now()

	query := `
		UPDATE exceptions SET
			status = 'resolved',
			resolved_by = $1,
			resolved_at = $2,
			resolution_notes = $3
		WHERE id = $4 AND user_id = $1 AND status = 'open'`

	result, err := h.db.DB.Exec(query, userUUID, now, req.ResolutionNotes, excUUID)
	if err != nil {
		log.Printf("Error resolving exception: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve exception"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "exception not found or already resolved"})
	}

	h.invalidateExceptionsCache(c.Context(), userID)

	return c.JSON(fiber.Map{
		"id":          excID,
		"status":      "resolved",
		"resolved_at": now,
		"message":     "exception resolved successfully",
	})
}

func (h *ExceptionsHandler) Dismiss(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	excID := c.Params("id")
	if excID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "exception id required"})
	}

	excUUID, err := uuid.Parse(excID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid exception id"})
	}

	userUUID, _ := uuid.Parse(userID)
	now := time.Now()

	query := `
		UPDATE exceptions SET
			status = 'dismissed',
			resolved_by = $1,
			resolved_at = $2
		WHERE id = $3 AND user_id = $1 AND status = 'open'`

	result, err := h.db.DB.Exec(query, userUUID, now, excUUID)
	if err != nil {
		log.Printf("Error dismissing exception: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to dismiss exception"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "exception not found or already resolved"})
	}

	h.invalidateExceptionsCache(c.Context(), userID)

	return c.JSON(fiber.Map{
		"id":      excID,
		"status":  "dismissed",
		"message": "exception dismissed successfully",
	})
}

func (h *ExceptionsHandler) Get(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	excID := c.Params("id")
	if excID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "exception id required"})
	}

	excUUID, err := uuid.Parse(excID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid exception id"})
	}

	query := `
		SELECT e.id, e.user_id, e.receipt_id, e.type, e.severity, e.description, 
		       e.suggested_action, e.status, e.resolved_by, e.resolved_at, 
		       e.resolution_notes, e.created_at,
		       r.vendor_name, r.amount, r.receipt_date, r.file_url, r.category
		FROM exceptions e
		LEFT JOIN receipts r ON e.receipt_id = r.id
		WHERE e.id = $1 AND e.user_id = $2`

	var exc models.Exception
	var vendorName, category, fileURL string
	var amount float64
	var receiptDate *time.Time

	err = h.db.DB.QueryRow(query, excUUID, userID).Scan(
		&exc.ID, &exc.UserID, &exc.ReceiptID, &exc.Type, &exc.Severity, &exc.Description,
		&exc.SuggestedAction, &exc.Status, &exc.ResolvedBy, &exc.ResolvedAt,
		&exc.ResolutionNotes, &exc.CreatedAt,
		&vendorName, &amount, &receiptDate, &fileURL, &category,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "exception not found"})
	}
	if err != nil {
		log.Printf("Error getting exception: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get exception"})
	}

	response := fiber.Map{
		"id":               exc.ID,
		"type":             exc.Type,
		"type_label":       formatExceptionType(exc.Type),
		"severity":         exc.Severity,
		"description":      exc.Description,
		"suggested_action": exc.SuggestedAction,
		"status":           exc.Status,
		"created_at":       exc.CreatedAt,
	}

	if exc.ResolvedBy != nil {
		response["resolved_by"] = exc.ResolvedBy
		response["resolved_at"] = exc.ResolvedAt
		response["resolution_notes"] = exc.ResolutionNotes
	}

	if exc.ReceiptID != nil {
		response["receipt"] = fiber.Map{
			"id":           exc.ReceiptID,
			"vendor_name":  vendorName,
			"amount":       amount,
			"receipt_date": receiptDate,
			"category":     category,
			"thumbnail":    fileURL,
		}
	}

	return c.JSON(response)
}

func (h *ExceptionsHandler) GetStats(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	cacheKey := fmt.Sprintf(exceptionCountCacheKey, userID)

	if h.redisCache != nil {
		cached, err := h.redisCache.Get(cacheKey)
		if err == nil && cached != "" {
			var stats fiber.Map
			if err := json.Unmarshal([]byte(cached), &stats); err == nil {
				c.Set("X-Cache", "HIT")
				return c.JSON(stats)
			}
		}
	}

	query := `
		SELECT 
			COUNT(*) FILTER (WHERE status = 'open') as open_count,
			COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high') as high_count,
			COUNT(*) FILTER (WHERE status = 'open' AND type = 'low_confidence') as low_confidence_count,
			COUNT(*) FILTER (WHERE status = 'open' AND type = 'duplicate_suspected') as duplicate_count,
			COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at > NOW() - INTERVAL '7 days') as resolved_this_week
		FROM exceptions 
		WHERE user_id = $1`

	var openCount, highCount, lowConfCount, dupCount, resolvedWeek int
	err := h.db.DB.QueryRow(query, userID).Scan(&openCount, &highCount, &lowConfCount, &dupCount, &resolvedWeek)
	if err != nil {
		log.Printf("Error getting exception stats: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get stats"})
	}

	stats := fiber.Map{
		"open_count":           openCount,
		"high_severity_count":  highCount,
		"low_confidence_count": lowConfCount,
		"duplicate_count":      dupCount,
		"resolved_this_week":   resolvedWeek,
		"needs_attention":      openCount > 0,
	}

	if h.redisCache != nil {
		if data, err := json.Marshal(stats); err == nil {
			_ = h.redisCache.Set(cacheKey, string(data), 30*time.Second)
		}
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(stats)
}

func (h *ExceptionsHandler) invalidateExceptionsCache(ctx context.Context, userID string) {
	if h.redisCache == nil {
		return
	}

	_ = h.redisCache.Delete(fmt.Sprintf(exceptionsCacheKey, userID, "open"))
	_ = h.redisCache.Delete(fmt.Sprintf(exceptionsCacheKey, userID, "resolved"))
	_ = h.redisCache.Delete(fmt.Sprintf(exceptionsCacheKey, userID, "dismissed"))
	_ = h.redisCache.Delete(fmt.Sprintf(exceptionsCacheKey, userID, ""))
	_ = h.redisCache.Delete(fmt.Sprintf(exceptionCountCacheKey, userID))
}

func formatExceptionType(t string) string {
	labels := map[string]string{
		"low_confidence":        "Low confidence",
		"duplicate_suspected":   "Possible duplicate",
		"amount_anomaly":        "Amount anomaly",
		"missing_date":          "Missing date",
		"missing_vendor":        "Missing vendor",
		"policy_violation":      "Policy violation",
		"unmatched_transaction": "Unmatched transaction",
		"missing_receipt":       "Missing receipt",
	}
	if label, ok := labels[t]; ok {
		return label
	}
	return t
}

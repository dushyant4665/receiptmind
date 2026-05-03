package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
)

type ReceiptHandler struct {
	DB               *database.Database
	Config           *config.Config
	StorageService   *services.StorageService
	QueueService     *services.QueueService
	ExceptionService *services.ExceptionService
	RuleService      *services.RuleService
	Redis            *redis.Client
}

func NewReceiptHandler(db *database.Database, cfg *config.Config, storageSvc *services.StorageService, queueSvc *services.QueueService, exceptionSvc *services.ExceptionService, ruleSvc *services.RuleService, redisClient *redis.Client) *ReceiptHandler {
	return &ReceiptHandler{
		DB:               db,
		Config:           cfg,
		StorageService:   storageSvc,
		QueueService:     queueSvc,
		ExceptionService: exceptionSvc,
		RuleService:      ruleSvc,
		Redis:            redisClient,
	}
}

var allowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".pdf":  true,
}

func (h *ReceiptHandler) Upload(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	orgID := c.Locals("organization_id").(string)

	// Paywall check: free limit is 50 receipts per month
	ctx := context.Background()
	var receiptCount int
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM receipts
		 WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
		orgID,
	).Scan(&receiptCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count receipts for paywall")
	} else if receiptCount >= 50 {
		return SendError(c, fiber.StatusPaymentRequired, "limit_reached: monthly receipt limit exceeded. Upgrade your plan to continue.")
	}

	file, err := c.FormFile("file")
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "file is required")
	}

	if file.Size > h.Config.MaxFileSize {
		return SendError(c, fiber.StatusBadRequest, "file size exceeds 10MB limit")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		return SendError(c, fiber.StatusBadRequest, "file type not allowed. accepted: jpg, jpeg, png, pdf")
	}

	fileData, err := file.Open()
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to read file")
	}
	defer fileData.Close()

	data := make([]byte, file.Size)
	if _, err := fileData.Read(data); err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to read file data")
	}

	// Generate file hash for duplicate detection
	fileHash := fmt.Sprintf("%x", sha256.Sum256(data))

	// Check for exact file hash duplicate
	var dupID string
	err = h.DB.Pool.QueryRow(ctx,
		`SELECT id FROM receipts WHERE organization_id = $1 AND file_hash = $2 AND status != 'failed' LIMIT 1`,
		orgID, fileHash,
	).Scan(&dupID)
	if err == nil {
		return SendError(c, fiber.StatusConflict, fmt.Sprintf("duplicate: this file was already uploaded (receipt %s)", dupID))
	}

	// Generate Base64 for persistent storage on Render Free Tier
	base64Data := "data:" + http.DetectContentType(data) + ";base64," + base64.StdEncoding.EncodeToString(data)

	filePath, err := h.StorageService.UploadFile(data, file.Filename, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upload file to storage")
		return SendError(c, fiber.StatusInternalServerError, "failed to upload file")
	}

	receiptID := uuid.New().String()

	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO receipts (id, organization_id, user_id, file_path, file_url, file_name, file_hash, status, currency, line_items, is_billable, is_reimbursable, needs_review, source, raw_extraction, user_corrections, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'USD', '[]'::jsonb, false, false, false, 'upload', '{}'::jsonb, '{}'::jsonb, NOW())`,
		receiptID, orgID, userID, filePath, base64Data, file.Filename, fileHash,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to insert receipt")
		return SendError(c, fiber.StatusInternalServerError, "failed to create receipt")
	}

	// 1. Process extraction immediately (Synchronous)
	aiService := services.NewAIService(h.Config)
	extraction, err := aiService.ExtractReceiptData(ctx, data)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("AI extraction failed completely")
		// Update DB to failed so it doesn't stay 'processing' forever
		_, _ = h.DB.Pool.Exec(ctx,
			"UPDATE receipts SET status = 'failed' WHERE id = $1",
			receiptID,
		)
		return SendError(c, fiber.StatusInternalServerError, fmt.Sprintf("AI extraction failed: %v", err))
	} else {
		// Apply rules
		extraction = h.RuleService.ApplyRules(ctx, orgID, extraction)

		var parsedDate *time.Time
		if extraction.ReceiptDate != "" {
			t, err := time.Parse("2006-01-02", extraction.ReceiptDate)
			if err == nil {
				parsedDate = &t
			}
		}

		// Update DB with results immediately
		_, err = h.DB.Pool.Exec(ctx,
			`UPDATE receipts SET 
				status = 'processed',
				vendor_name = $1, amount = $2, receipt_date = $3, category = $4, confidence = $5,
				raw_vendor_name = $1, raw_amount = $2, raw_date = $3, raw_category = $4, raw_confidence = $5
			 WHERE id = $6`,
			extraction.VendorName, extraction.Amount, parsedDate, extraction.Category, extraction.Confidence,
			receiptID,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to update receipt results")
		}
	}

	// Invalidate caches
	h.invalidateCache(orgID)

	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(fiber.Map{
		"receipt_id": receiptID,
		"status":     "processed",
	}))
}

func (h *ReceiptHandler) GetReceipt(c *fiber.Ctx) error {
	receiptID := c.Params("id")
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	var receipt models.Receipt
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT id, organization_id, user_id, file_path, file_url, status,
		        raw_vendor_name, raw_amount, raw_date, raw_category, raw_confidence,
		        vendor_name, amount, receipt_date, category, confidence, created_at
		 FROM receipts WHERE id = $1 AND organization_id = $2`,
		receiptID, orgID,
	).Scan(
		&receipt.ID, &receipt.OrganizationID, &receipt.UserID, &receipt.FilePath, &receipt.FileURL, &receipt.Status,
		&receipt.RawVendorName, &receipt.RawAmount, &receipt.RawDate, &receipt.RawCategory, &receipt.RawConfidence,
		&receipt.VendorName, &receipt.Amount, &receipt.ReceiptDate, &receipt.Category, &receipt.Confidence, &receipt.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "receipt not found")
		}
		log.Error().Err(err).Msg("Failed to fetch receipt")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	signedURL, err := h.StorageService.GetSignedURL(receipt.FilePath)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate signed URL")
		signedURL = ""
	}

	exceptions, _ := h.ExceptionService.GetByReceiptID(ctx, receiptID, orgID)

	resp := h.mapReceipt(receipt)
	resp["file_url"] = signedURL
	resp["exceptions"] = exceptions

	return c.JSON(SuccessResponse(resp))
}

func (h *ReceiptHandler) ListReceipts(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	search := c.Query("search")
	status := c.Query("status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	minAmount := c.Query("min_amount")
	maxAmount := c.Query("max_amount")

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	ctx := context.Background()

	// Try cache first (10s TTL)
	cacheKey := fmt.Sprintf("receipts:%s:%d:%d:%s:%s:%s:%s:%s:%s", orgID, limit, offset, search, status, startDate, endDate, minAmount, maxAmount)
	cached, err := h.Redis.Get(ctx, cacheKey).Result()
	if err == nil {
		c.Set("X-Cache", "HIT")
		return c.Type("json").SendString(cached)
	}

	// Build dynamic query with filters
	query := `SELECT id, organization_id, user_id, file_path, file_url, status,
			          raw_vendor_name, raw_amount, raw_date, raw_category, raw_confidence,
			          vendor_name, amount, receipt_date, category, confidence, created_at
			   FROM receipts WHERE organization_id = $1`
	countQuery := "SELECT COUNT(*) FROM receipts WHERE organization_id = $1"
	args := []interface{}{orgID}
	argIdx := 2

	if search != "" {
		query += fmt.Sprintf(" AND (vendor_name ILIKE $%d OR raw_vendor_name ILIKE $%d)", argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (vendor_name ILIKE $%d OR raw_vendor_name ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	if startDate != "" {
		t, err := time.Parse("2006-01-02", startDate)
		if err == nil {
			query += fmt.Sprintf(" AND receipt_date >= $%d", argIdx)
			countQuery += fmt.Sprintf(" AND receipt_date >= $%d", argIdx)
			args = append(args, t)
			argIdx++
		}
	}

	if endDate != "" {
		t, err := time.Parse("2006-01-02", endDate)
		if err == nil {
			query += fmt.Sprintf(" AND receipt_date <= $%d", argIdx)
			countQuery += fmt.Sprintf(" AND receipt_date <= $%d", argIdx)
			args = append(args, t)
			argIdx++
		}
	}

	if minAmount != "" {
		if amt, err := strconv.ParseFloat(minAmount, 64); err == nil {
			query += fmt.Sprintf(" AND amount >= $%d", argIdx)
			countQuery += fmt.Sprintf(" AND amount >= $%d", argIdx)
			args = append(args, amt)
			argIdx++
		}
	}

	if maxAmount != "" {
		if amt, err := strconv.ParseFloat(maxAmount, 64); err == nil {
			query += fmt.Sprintf(" AND amount <= $%d", argIdx)
			countQuery += fmt.Sprintf(" AND amount <= $%d", argIdx)
			args = append(args, amt)
			argIdx++
		}
	}

	var total int
	err = h.DB.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	query += " ORDER BY created_at DESC"
	args = append(args, limit, offset)
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)

	rows, err := h.DB.Pool.Query(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	receipts := make([]models.Receipt, 0)
	for rows.Next() {
		var r models.Receipt
		if err := rows.Scan(
			&r.ID, &r.OrganizationID, &r.UserID, &r.FilePath, &r.FileURL, &r.Status,
			&r.RawVendorName, &r.RawAmount, &r.RawDate, &r.RawCategory, &r.RawConfidence,
			&r.VendorName, &r.Amount, &r.ReceiptDate, &r.Category, &r.Confidence, &r.CreatedAt,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan receipt row")
			continue
		}
		receipts = append(receipts, r)
	}

	resp := SuccessResponse(models.ReceiptListResponse{
		Receipts: receipts,
		Total:    total,
		Limit:    limit,
		Offset:   offset,
	})

	// Cache the result
	if data, err := json.Marshal(resp); err == nil {
		h.Redis.Set(ctx, cacheKey, data, 10*time.Second)
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(resp)
}

func (h *ReceiptHandler) ListExpenses(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	rows, err := h.DB.Pool.Query(ctx,
		`SELECT id, COALESCE(vendor_name, raw_vendor_name, 'Unknown'), 
		        COALESCE(amount, 0), COALESCE(receipt_date, created_at), 
		        COALESCE(category, 'Uncategorized'), status
		 FROM receipts WHERE organization_id = $1
		 ORDER BY created_at DESC LIMIT 50`,
		orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list expenses")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	expenses := make([]fiber.Map, 0)
	for rows.Next() {
		var id, vendor, category, status string
		var amount float64
		var date time.Time
		if err := rows.Scan(&id, &vendor, &amount, &date, &category, &status); err != nil {
			log.Error().Err(err).Msg("Failed to scan expense row")
			continue
		}

		expenses = append(expenses, fiber.Map{
			"id":          id,
			"vendor_name": vendor,
			"amount":      amount,
			"currency":    "USD",
			"date":        date.Format("2006-01-02"),
			"category":    category,
			"description": "Receipt upload",
			"status":      status,
		})
	}

	return c.JSON(SuccessResponse(expenses))
}

func (h *ReceiptHandler) EditReceipt(c *fiber.Ctx) error {
	receiptID := c.Params("id")
	orgID := c.Locals("organization_id").(string)

	var req models.ReceiptEditRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	ctx := context.Background()

	var exists string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id FROM receipts WHERE id = $1 AND organization_id = $2",
		receiptID, orgID,
	).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "receipt not found")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	setClauses := ""
	args := []interface{}{}
	argIdx := 1

	if req.VendorName != nil {
		setClauses += fmt.Sprintf("vendor_name = $%d, ", argIdx)
		args = append(args, *req.VendorName)
		argIdx++
	}
	if req.Amount != nil {
		setClauses += fmt.Sprintf("amount = $%d, ", argIdx)
		args = append(args, *req.Amount)
		argIdx++
	}
	if req.ReceiptDate != nil {
		parsedDate, err := time.Parse("2006-01-02", *req.ReceiptDate)
		if err != nil {
			return SendError(c, fiber.StatusBadRequest, "invalid receipt_date format, expected YYYY-MM-DD")
		}
		setClauses += fmt.Sprintf("receipt_date = $%d, ", argIdx)
		args = append(args, parsedDate)
		argIdx++
	}
	if req.Category != nil {
		setClauses += fmt.Sprintf("category = $%d, ", argIdx)
		args = append(args, *req.Category)
		argIdx++
	}

	if len(setClauses) == 0 {
		return SendError(c, fiber.StatusBadRequest, "no fields to update")
	}

	setClauses = setClauses[:len(setClauses)-2]
	args = append(args, receiptID, orgID)
	query := fmt.Sprintf("UPDATE receipts SET %s WHERE id = $%d AND organization_id = $%d", setClauses, argIdx, argIdx+1)

	_, err = h.DB.Pool.Exec(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update receipt")
		return SendError(c, fiber.StatusInternalServerError, "failed to update receipt")
	}

	if req.VendorName != nil && req.Category != nil {
		go h.RuleService.AutoLearnFromEdit(context.Background(), orgID, *req.VendorName, *req.Category)
	}

	h.invalidateCache(orgID)

	return c.JSON(SuccessResponse(fiber.Map{"id": receiptID, "updated": true}))
}

func (h *ReceiptHandler) DeleteReceipt(c *fiber.Ctx) error {
	receiptID := c.Params("id")
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	var filePath string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT file_path FROM receipts WHERE id = $1 AND organization_id = $2",
		receiptID, orgID,
	).Scan(&filePath)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "receipt not found")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if err := h.StorageService.DeleteFile(ctx, filePath); err != nil {
		log.Error().Err(err).Str("file_path", filePath).Msg("Failed to delete file from storage")
	}

	_, err = h.DB.Pool.Exec(ctx,
		"DELETE FROM receipts WHERE id = $1 AND organization_id = $2",
		receiptID, orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to delete receipt from DB")
		return SendError(c, fiber.StatusInternalServerError, "failed to delete receipt")
	}

	h.invalidateCache(orgID)

	return c.JSON(SuccessResponse(fiber.Map{"id": receiptID, "deleted": true}))
}

func (h *ReceiptHandler) invalidateCache(orgID string) {
	ctx := context.Background()
	h.Redis.Del(ctx, fmt.Sprintf("dashboard:%s", orgID))
	iter := h.Redis.Scan(ctx, 0, fmt.Sprintf("receipts:%s:*", orgID), 100).Iterator()
	for iter.Next(ctx) {
		h.Redis.Del(ctx, iter.Val())
	}
}

func (h *ReceiptHandler) mapReceipt(r models.Receipt) fiber.Map {
	// If file_url starts with data: (Base64), use it directly
	fileURL := r.FileURL
	if fileURL == "" {
		fileURL = r.FilePath
	}

	return fiber.Map{
		"id":             r.ID,
		"organizationId": r.OrganizationID,
		"userId":         r.UserID,
		"filePath":       r.FilePath,
		"fileUrl":        fileURL,
		"status":         r.Status,
		"rawVendorName":  r.RawVendorName,
		"rawAmount":      r.RawAmount,
		"rawDate":        r.RawDate,
		"rawCategory":    r.RawCategory,
		"rawConfidence":  r.RawConfidence,
		"vendorName":     r.VendorName,
		"amount":         r.Amount,
		"receiptDate":    r.ReceiptDate,
		"category":       r.Category,
		"confidence":     r.Confidence,
		"createdAt":      r.CreatedAt,
	}
}

package api

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
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
	"receiptmind-backend/internal/db"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
)

type ReceiptHandler struct {
	DB               *db.Database
	Config           *config.Config
	StorageService   *services.StorageService
	QueueService     *services.QueueService
	ExceptionService *services.ExceptionService
	RuleService      *services.RuleService
	Redis            *redis.Client
}

func NewReceiptHandler(db *db.Database, cfg *config.Config, storageSvc *services.StorageService, queueSvc *services.QueueService, exceptionSvc *services.ExceptionService, ruleSvc *services.RuleService, redisClient *redis.Client) *ReceiptHandler {
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

	ctx := context.Background()

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

	data, err := io.ReadAll(fileData)
	if err != nil {
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
	mimeType := http.DetectContentType(data)
	base64Data := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)

	filePath, err := h.StorageService.UploadFile(data, file.Filename, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upload file to storage")
		return SendError(c, fiber.StatusInternalServerError, "failed to upload file")
	}

	receiptID := uuid.New().String()

	// 1. Save receipt immediately. Heavy extraction is always done by workers.
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO receipts (id, organization_id, user_id, file_path, file_url, file_name, file_hash, status, processing_state, currency, line_items, is_billable, is_reimbursable, needs_review, source, raw_extraction, user_corrections, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', 'queued', 'USD', '[]'::jsonb, false, false, false, 'upload', '{}'::jsonb, '{}'::jsonb, NOW())`,
		receiptID, orgID, userID, filePath, base64Data, file.Filename, fileHash,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to insert receipt")
		return SendError(c, fiber.StatusInternalServerError, "failed to create receipt")
	}
	_, _ = h.DB.Pool.Exec(ctx,
		`INSERT INTO storage_objects (id, organization_id, receipt_id, path, file_hash, size_bytes, content_type)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (path) DO NOTHING`,
		uuid.NewString(), orgID, receiptID, filePath, fileHash, len(data), mimeType,
	)
	h.invalidateCache(orgID)

	queuePayload := map[string]interface{}{
		"receipt_id":      receiptID,
		"file_url":        filePath,
		"org_id":          orgID,
		"idempotency_key": fmt.Sprintf("receipt:%s", receiptID),
	}
	if err := h.QueueService.EnqueueWithPriority(ctx, "process_receipt", queuePayload, "high"); err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to enqueue receipt processing job")
		return SendError(c, fiber.StatusServiceUnavailable, "receipt saved but processing queue is unavailable")
	}
	_, _ = h.DB.Pool.Exec(ctx,
		`INSERT INTO receipt_processing_jobs (id, receipt_id, organization_id, processing_state)
		 VALUES ($1, $2, $3, 'queued')`,
		uuid.NewString(), receiptID, orgID,
	)

	// Return SUCCESS immediately with the saved data
	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(fiber.Map{
		"id":          receiptID,
		"receipt_id":  receiptID,
		"status":      "processing",
		"file_url":    base64Data, // frontend expects file_url or fileUrl
		"vendor_name": "AI Extracting...",
		"created_at":  time.Now().Format(time.RFC3339),
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

	exceptions, _ := h.ExceptionService.GetByReceiptID(ctx, receiptID, orgID)
	resp := h.mapReceipt(receipt)
	// Always prefer the stored file_url (Base64) for preview reliability on Render
	if receipt.FileURL != "" {
		resp["file_url"] = receipt.FileURL
	} else {
		signedURL, err := h.StorageService.GetSignedURL(receipt.FilePath)
		if err == nil {
			resp["file_url"] = signedURL
		}
	}
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
		search = strings.TrimSpace(search)
		if strings.HasPrefix(search, ">") || strings.HasPrefix(search, "<") {
			operator := search[:1]
			if amt, err := strconv.ParseFloat(strings.TrimSpace(search[1:]), 64); err == nil {
				query += fmt.Sprintf(" AND amount %s $%d", operator, argIdx)
				countQuery += fmt.Sprintf(" AND amount %s $%d", operator, argIdx)
				args = append(args, amt)
				argIdx++
			}
		} else if strings.EqualFold(search, "last month") {
			now := time.Now()
			start := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, now.Location())
			end := start.AddDate(0, 1, 0)
			query += fmt.Sprintf(" AND receipt_date >= $%d AND receipt_date < $%d", argIdx, argIdx+1)
			countQuery += fmt.Sprintf(" AND receipt_date >= $%d AND receipt_date < $%d", argIdx, argIdx+1)
			args = append(args, start, end)
			argIdx += 2
		} else {
			query += fmt.Sprintf(" AND (vendor_name ILIKE $%d OR raw_vendor_name ILIKE $%d OR category ILIKE $%d)", argIdx, argIdx, argIdx)
			countQuery += fmt.Sprintf(" AND (vendor_name ILIKE $%d OR raw_vendor_name ILIKE $%d OR category ILIKE $%d)", argIdx, argIdx, argIdx)
			args = append(args, "%"+search+"%")
			argIdx++
		}
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
	_, _ = h.DB.Pool.Exec(ctx, "UPDATE storage_objects SET deleted_at = NOW() WHERE organization_id = $1 AND path = $2", orgID, filePath)

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

func (h *ReceiptHandler) BulkDeleteReceipts(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	var req struct {
		ReceiptIDs []string `json:"receipt_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if len(req.ReceiptIDs) == 0 {
		return SendError(c, fiber.StatusBadRequest, "no receipt IDs provided")
	}

	ctx := context.Background()

	// Get file paths first for deletion
	rows, err := h.DB.Pool.Query(ctx,
		"SELECT file_path FROM receipts WHERE id = ANY($1) AND organization_id = $2",
		req.ReceiptIDs, orgID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var filePath string
			if err := rows.Scan(&filePath); err == nil {
				_ = h.StorageService.DeleteFile(ctx, filePath)
				_, _ = h.DB.Pool.Exec(ctx, "UPDATE storage_objects SET deleted_at = NOW() WHERE organization_id = $1 AND path = $2", orgID, filePath)
			}
		}
	}

	_, err = h.DB.Pool.Exec(ctx,
		"DELETE FROM receipts WHERE id = ANY($1) AND organization_id = $2",
		req.ReceiptIDs, orgID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to bulk delete receipts")
		return SendError(c, fiber.StatusInternalServerError, "failed to delete receipts")
	}

	h.invalidateCache(orgID)

	return c.JSON(SuccessResponse(fiber.Map{"count": len(req.ReceiptIDs), "deleted": true}))
}

func (h *ReceiptHandler) BulkExportReceipts(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	var req struct {
		ReceiptIDs []string `json:"receipt_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if len(req.ReceiptIDs) == 0 {
		return SendError(c, fiber.StatusBadRequest, "no receipt IDs provided")
	}

	ctx := context.Background()
	filename := fmt.Sprintf("bulk_export_%s.csv", time.Now().Format("2006-01-02"))

	query := `SELECT
				id,
				COALESCE(vendor_name, raw_vendor_name, 'Unknown') AS export_vendor,
				COALESCE(amount, raw_amount, 0)::double precision AS export_amount,
				COALESCE(category, raw_category, 'Uncategorized') AS export_category,
				COALESCE(receipt_date, raw_date, created_at) AS export_date,
				COALESCE(confidence, raw_confidence, 0) AS export_confidence,
				status,
				COALESCE(currency, 'USD') AS export_currency,
				COALESCE(source, 'upload') AS export_source,
				COALESCE(file_name, file_path, '') AS export_file_name,
				created_at
			  FROM receipts 
			  WHERE organization_id = $1 AND id = ANY($2)
			  ORDER BY created_at DESC`

	rows, err := h.DB.Pool.Query(ctx, query, orgID, req.ReceiptIDs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query receipts for bulk export")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Write CSV to response
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer rows.Close()
		csvWriter := csv.NewWriter(w)
		_ = csvWriter.Write([]string{
			"Receipt ID", "Vendor", "Amount", "Currency", "Category", "Receipt Date", "Confidence %", "Status", "Source", "File Name", "Created At",
		})

		for rows.Next() {
			var id, vendor, category, status, currency, source, fileName string
			var amount, confidence float64
			var date, createdAt time.Time

			if err := rows.Scan(&id, &vendor, &amount, &category, &date, &confidence, &status, &currency, &source, &fileName, &createdAt); err != nil {
				continue
			}

			_ = csvWriter.Write([]string{
				id, vendor, fmt.Sprintf("%.2f", amount), currency, category, date.Format("2006-01-02"), fmt.Sprintf("%.0f%%", confidence*100), status, source, fileName, createdAt.Format("2006-01-02 15:04:05"),
			})
		}
		csvWriter.Flush()
		w.Flush()
	})

	return nil
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
	return fiber.Map{
		"id":              r.ID,
		"organization_id": r.OrganizationID,
		"user_id":         r.UserID,
		"status":          r.Status,
		"vendor_name":     r.VendorName,
		"amount":          r.Amount,
		"receipt_date":    r.ReceiptDate,
		"category":        r.Category,
		"confidence":      r.Confidence,
		"file_url":        r.FileURL,
		"created_at":      r.CreatedAt,
	}
}


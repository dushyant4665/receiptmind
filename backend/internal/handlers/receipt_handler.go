package handlers

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
}

func NewReceiptHandler(db *database.Database, cfg *config.Config, storageSvc *services.StorageService, queueSvc *services.QueueService, exceptionSvc *services.ExceptionService, ruleSvc *services.RuleService) *ReceiptHandler {
	return &ReceiptHandler{
		DB:               db,
		Config:           cfg,
		StorageService:   storageSvc,
		QueueService:     queueSvc,
		ExceptionService: exceptionSvc,
		RuleService:      ruleSvc,
	}
}

var allowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".pdf":  true,
}

func (h *ReceiptHandler) Upload(c *fiber.Ctx) error {
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

	userID := c.Locals("user_id").(string)
	orgID := c.Locals("organization_id").(string)

	filePath, err := h.StorageService.UploadFile(data, file.Filename, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upload file to storage")
		return SendError(c, fiber.StatusInternalServerError, "failed to upload file")
	}

	receiptID := uuid.New().String()

	ctx := context.Background()
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO receipts (id, organization_id, user_id, file_path, file_url, file_name, status, currency, line_items, is_billable, is_reimbursable, needs_review, source, raw_extraction, user_corrections, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'USD', '[]'::jsonb, false, false, false, 'upload', '{}'::jsonb, '{}'::jsonb, NOW())`,
		receiptID, orgID, userID, filePath, filePath, file.Filename,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to insert receipt")
		return SendError(c, fiber.StatusInternalServerError, "failed to create receipt")
	}

	err = h.QueueService.Enqueue(ctx, "process_receipt", map[string]interface{}{
		"receipt_id": receiptID,
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to enqueue receipt job")
		return SendError(c, fiber.StatusInternalServerError, "failed to queue receipt for processing")
	}

	return c.Status(fiber.StatusCreated).JSON(SuccessResponse(models.ReceiptUploadResponse{
		ReceiptID: receiptID,
		Status:    "pending",
	}))
}

func (h *ReceiptHandler) GetReceipt(c *fiber.Ctx) error {
	receiptID := c.Params("id")
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	var receipt models.Receipt
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT id, organization_id, user_id, file_path, status,
		        raw_vendor_name, raw_amount, raw_date, raw_category, raw_confidence,
		        vendor_name, amount, receipt_date, category, confidence, created_at
		 FROM receipts WHERE id = $1 AND organization_id = $2`,
		receiptID, orgID,
	).Scan(
		&receipt.ID, &receipt.OrganizationID, &receipt.UserID, &receipt.FilePath, &receipt.Status,
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

	resp := fiber.Map{
		"id":              receipt.ID,
		"organization_id": receipt.OrganizationID,
		"user_id":         receipt.UserID,
		"file_path":       receipt.FilePath,
		"status":          receipt.Status,
		"raw_vendor_name": receipt.RawVendorName,
		"raw_amount":      receipt.RawAmount,
		"raw_date":        receipt.RawDate,
		"raw_category":    receipt.RawCategory,
		"raw_confidence":  receipt.RawConfidence,
		"vendor_name":     receipt.VendorName,
		"amount":          receipt.Amount,
		"receipt_date":    receipt.ReceiptDate,
		"category":        receipt.Category,
		"confidence":      receipt.Confidence,
		"created_at":      receipt.CreatedAt,
		"file_url":        signedURL,
		"exceptions":      exceptions,
	}

	return c.JSON(SuccessResponse(resp))
}

func (h *ReceiptHandler) ListReceipts(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	ctx := context.Background()

	var total int
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM receipts WHERE organization_id = $1",
		orgID,
	).Scan(&total)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	rows, err := h.DB.Pool.Query(ctx,
		`SELECT id, organization_id, user_id, file_path, status,
		        raw_vendor_name, raw_amount, raw_date, raw_category, raw_confidence,
		        vendor_name, amount, receipt_date, category, confidence, created_at
		 FROM receipts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		orgID, limit, offset,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list receipts")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	receipts := make([]models.Receipt, 0)
	for rows.Next() {
		var r models.Receipt
		if err := rows.Scan(
			&r.ID, &r.OrganizationID, &r.UserID, &r.FilePath, &r.Status,
			&r.RawVendorName, &r.RawAmount, &r.RawDate, &r.RawCategory, &r.RawConfidence,
			&r.VendorName, &r.Amount, &r.ReceiptDate, &r.Category, &r.Confidence, &r.CreatedAt,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan receipt row")
			continue
		}
		receipts = append(receipts, r)
	}

	return c.JSON(SuccessResponse(models.ReceiptListResponse{
		Receipts: receipts,
		Total:    total,
		Limit:    limit,
		Offset:   offset,
	}))
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

	return c.JSON(SuccessResponse(fiber.Map{"id": receiptID, "deleted": true}))
}

package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
	"github.com/receiptmind/backend/internal/services"
)

type ReceiptHandler struct {
	db      *database.PostgresDB
	cache   cacheStore
	storage *services.StorageService
	openai  *services.OpenAIService
	gemini  *services.GeminiService
}

func NewReceiptHandler(db *database.PostgresDB, cacheClient cacheStore, storage *services.StorageService, openai *services.OpenAIService, gemini *services.GeminiService) *ReceiptHandler {
	return &ReceiptHandler{db: db, cache: normalizeCacheStore(cacheClient), storage: storage, openai: openai, gemini: gemini}
}

func (h *ReceiptHandler) Upload(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	files, err := c.MultipartForm()
	if err != nil || files == nil || len(files.File["receipts"]) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "receipts files are required"})
	}
	if h.storage == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "storage service not configured"})
	}

	uploaded := make([]models.Receipt, 0)
	for _, fileHeader := range files.File["receipts"] {
		receiptID := uuid.New()
		fileURL, fileSize, mimeType, fileData, err := h.storage.UploadReceiptFile(c.Context(), userID, fileHeader)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to upload receipt"})
		}

		_, err = h.db.DB.Exec(
			`INSERT INTO receipts (id, user_id, filename, file_url, file_size, mime_type, status, created_at)
				 VALUES ($1,$2,$3,$4,$5,$6,'processing',NOW())`,
			receiptID, userID, fileHeader.Filename, fileURL, fileSize, mimeType,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create receipt"})
		}

		var extracted *models.ReceiptExtractionResult

		// Use fileData for extraction (already read by storage service)
		if fileData != nil {
			// Try Gemini first (better for images, cheaper)
			if h.gemini != nil {
				extracted, _ = h.gemini.ExtractReceiptData(c.Context(), fileData, mimeType)
			}
			// Fallback to OpenAI if Gemini fails or not configured
			if extracted == nil && h.openai != nil {
				extracted, _ = h.openai.ExtractReceiptData(c.Context(), fileURL)
			}
		}

		status := "extracted"
		var vendorName sql.NullString
		var currency sql.NullString
		var category sql.NullString
		var description sql.NullString
		var amount sql.NullFloat64
		var receiptDate sql.NullTime
		var confidence sql.NullFloat64
		var needsReview bool

		if extracted != nil {
			if extracted.VendorName != "" {
				vendorName = sql.NullString{String: extracted.VendorName, Valid: true}
			}
			if extracted.Currency != "" {
				currency = sql.NullString{String: extracted.Currency, Valid: true}
			}
			if extracted.Category != "" {
				category = sql.NullString{String: extracted.Category, Valid: true}
			}
			if extracted.Description != "" {
				description = sql.NullString{String: extracted.Description, Valid: true}
			}
			amount = sql.NullFloat64{Float64: extracted.Amount, Valid: extracted.Amount != 0}
			receiptDate = sql.NullTime{Time: extracted.Date, Valid: !extracted.Date.IsZero()}
			confidence = sql.NullFloat64{Float64: extracted.Confidence, Valid: extracted.Confidence > 0}

			needsReview = extracted.Confidence < 0.75 || extracted.VendorName == "" ||
				extracted.Amount == 0 || extracted.Date.IsZero()

			if needsReview {
				status = "needs_review"
			}
		} else {
			status = "pending"
			needsReview = true
		}

		processedAt := time.Now()
		_, _ = h.db.DB.Exec(
			`UPDATE receipts SET status=$1, vendor_name=$2, amount=$3, currency=$4, receipt_date=$5, category=$6, description=$7, processed_at=$8, extraction_confidence=$9, needs_review=$10 WHERE id=$11 AND user_id=$12`,
			status, vendorName, amount, currency, receiptDate, category, description, processedAt, confidence, needsReview, receiptID, userID,
		)

		if needsReview && extracted != nil {
			userUUID, _ := uuid.Parse(userID)
			h.createExceptionForReceipt(receiptID, userUUID, extracted, "low_confidence")
		}

		var receipt models.Receipt
		err = h.db.DB.QueryRow(
			`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
			       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
			 FROM receipts WHERE id=$1 AND user_id=$2`,
			receiptID, userID,
		).Scan(
			&receipt.ID,
			&receipt.UserID,
			&receipt.Filename,
			&receipt.FileURL,
			&receipt.FileSize,
			&receipt.MimeType,
			&receipt.Status,
			&receipt.VendorName,
			&receipt.Amount,
			&receipt.Currency,
			&receipt.Date,
			&receipt.Category,
			&receipt.Description,
			&receipt.CreatedAt,
			&receipt.ProcessedAt,
		)
		if err == nil {
			uploaded = append(uploaded, receipt)
		}
	}
	h.invalidateDashboardCache(userID)

	return c.JSON(fiber.Map{"receipts": uploaded})
}

func (h *ReceiptHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	rows, err := h.db.DB.Query(
		`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
		       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
		 FROM receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch receipts"})
	}
	defer rows.Close()

	receipts := make([]models.Receipt, 0)
	for rows.Next() {
		var r models.Receipt
		if err := rows.Scan(
			&r.ID,
			&r.UserID,
			&r.Filename,
			&r.FileURL,
			&r.FileSize,
			&r.MimeType,
			&r.Status,
			&r.VendorName,
			&r.Amount,
			&r.Currency,
			&r.Date,
			&r.Category,
			&r.Description,
			&r.CreatedAt,
			&r.ProcessedAt,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read receipts"})
		}
		receipts = append(receipts, r)
	}

	return c.JSON(receipts)
}

func (h *ReceiptHandler) Get(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	rid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}
	var r models.Receipt
	err = h.db.DB.QueryRow(
		`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
		       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
		 FROM receipts WHERE id=$1 AND user_id=$2`,
		rid, userID,
	).Scan(
		&r.ID,
		&r.UserID,
		&r.Filename,
		&r.FileURL,
		&r.FileSize,
		&r.MimeType,
		&r.Status,
		&r.VendorName,
		&r.Amount,
		&r.Currency,
		&r.Date,
		&r.Category,
		&r.Description,
		&r.CreatedAt,
		&r.ProcessedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch receipt"})
	}
	return c.JSON(r)
}

func (h *ReceiptHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	rid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}
	res, err := h.db.DB.Exec(`DELETE FROM receipts WHERE id=$1 AND user_id=$2`, rid, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete receipt"})
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Not found"})
	}
	h.invalidateDashboardCache(userID)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ReceiptHandler) invalidateDashboardCache(userID string) {
	if h.cache == nil {
		return
	}
	_ = h.cache.DeleteByPrefix("dashboard:" + userID + ":")
}

func (h *ReceiptHandler) createExceptionForReceipt(receiptID uuid.UUID, userID uuid.UUID, extracted *models.ReceiptExtractionResult, excType string) {
	excID := uuid.New()
	now := time.Now()

	description := "Low confidence extraction"
	if extracted.VendorName == "" {
		description = "Vendor name not detected"
	} else if extracted.Amount == 0 {
		description = "Amount not detected"
	} else if extracted.Date.IsZero() {
		description = "Date not detected"
	}

	query := `INSERT INTO exceptions (id, user_id, receipt_id, type, severity, description, suggested_action, status, created_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, _ = h.db.DB.Exec(query, excID, userID, receiptID, excType, "medium", description,
		"Review and confirm extracted data", "open", now)
}

func (h *ReceiptHandler) ExportCSV(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.DB.Query(`
		SELECT vendor_name, amount, currency, COALESCE(category, 'Other'), 
		       COALESCE(description, ''), COALESCE(receipt_date::text, ''), 
		       status, created_at::text, file_url
		FROM receipts WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch receipts"})
	}
	defer rows.Close()

	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=receipts.csv")

	// Write CSV header
	c.WriteString("Vendor,Amount,Currency,Category,Description,Date,Status,Created At,File URL\n")

	for rows.Next() {
		var vendor, currency, category, description, date, status, createdAt, fileURL sql.NullString
		var amount sql.NullFloat64

		if err := rows.Scan(&vendor, &amount, &currency, &category, &description, &date, &status, &createdAt, &fileURL); err != nil {
			continue
		}

		// Escape commas in strings
		escape := func(s string) string {
			if strings.Contains(s, ",") {
				return `"` + s + `"`
			}
			return s
		}

		amt := ""
		if amount.Valid {
			amt = fmt.Sprintf("%.2f", amount.Float64)
		}

		c.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			escape(vendor.String), amt, currency.String,
			escape(category.String), escape(description.String), date.String,
			status.String, createdAt.String, fileURL.String))
	}

	return nil
}

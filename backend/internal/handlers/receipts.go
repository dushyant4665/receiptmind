package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/models"
	"github.com/receiptmind/backend/internal/services"
)

type ReceiptHandler struct {
	db      *database.PostgresDB
	storage *services.StorageService
	openai  *services.OpenAIService
}

func NewReceiptHandler(db *database.PostgresDB, storage *services.StorageService, openai *services.OpenAIService) *ReceiptHandler {
	return &ReceiptHandler{db: db, storage: storage, openai: openai}
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
		fileURL, fileSize, mimeType, err := h.storage.UploadReceiptFile(c.Context(), userID, fileHeader)
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
		if h.openai != nil {
			extracted, _ = h.openai.ExtractReceiptData(c.Context(), fileURL)
		}

		status := "completed"
		var vendorName sql.NullString
		var currency sql.NullString
		var category sql.NullString
		var description sql.NullString
		var amount sql.NullFloat64
		var receiptDate sql.NullTime
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
		} else {
			status = "pending"
		}
		processedAt := time.Now()
		_, _ = h.db.DB.Exec(
			`UPDATE receipts SET status=$1, vendor_name=$2, amount=$3, currency=$4, receipt_date=$5, category=$6, description=$7, processed_at=$8 WHERE id=$9 AND user_id=$10`,
			status, vendorName, amount, currency, receiptDate, category, description, processedAt, receiptID, userID,
		)

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
	return c.SendStatus(fiber.StatusNoContent)
}

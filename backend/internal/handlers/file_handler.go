package handlers

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/services"
)

type FileHandler struct {
	DB         *database.Database
	PDFService *services.PDFService
}

func NewFileHandler(db *database.Database, pdfSvc *services.PDFService) *FileHandler {
	return &FileHandler{
		DB:         db,
		PDFService: pdfSvc,
	}
}

func (h *FileHandler) GetFile(c *fiber.Ctx) error {
	receiptID := c.Params("id")
	orgID := c.Locals("organization_id").(string)
	original := c.Query("original") == "true"

	ctx := context.Background()
	var filePath string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT file_path FROM receipts WHERE id = $1 AND organization_id = $2",
		receiptID, orgID,
	).Scan(&filePath)

	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "receipt file not found")
		}
		return SendError(c, fiber.StatusInternalServerError, "database error")
	}

	// Ensure no path traversal
	cleanPath := filepath.Clean(filePath)
	if strings.Contains(cleanPath, "..") {
		return SendError(c, fiber.StatusForbidden, "invalid file path")
	}

	// Try multiple possible locations for the file
	// 1. uploads/{cleanPath}
	// 2. {cleanPath} (in case it already has uploads/ or is absolute)
	fullPath := filepath.Join("uploads", cleanPath)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		fullPath = cleanPath
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			log.Warn().Str("receipt_id", receiptID).Str("path", filePath).Msg("File not found on disk")
			return SendError(c, fiber.StatusNotFound, "file not found on disk")
		}
	}

	ext := strings.ToLower(filepath.Ext(fullPath))

	// If it's a PDF and they didn't ask for the original, serve a thumbnail for the <img> tag
	if ext == ".pdf" && !original {
		return h.servePDFThumbnail(c, fullPath)
	}

	// Serve original file (image or pdf)
	return c.SendFile(fullPath)
}

func (h *FileHandler) servePDFThumbnail(c *fiber.Ctx, pdfPath string) error {
	ctx := context.Background()
	pdfBytes, err := os.ReadFile(pdfPath)
	if err != nil {
		return SendError(c, fiber.StatusNotFound, "failed to read pdf file")
	}

	data, err := h.PDFService.ConvertPDFToImages(ctx, pdfBytes)
	if err != nil || len(data) == 0 {
		log.Error().Err(err).Str("path", pdfPath).Msg("Failed to generate PDF thumbnail")
		// Fallback to original file or generic icon
		return c.SendFile(pdfPath)
	}

	c.Set("Content-Type", "image/png")
	return c.Send(data[0]) // Return first page as thumbnail
}

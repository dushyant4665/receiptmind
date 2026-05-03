package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
)

type ExportHandler struct {
	DB *database.Database
}

func NewExportHandler(db *database.Database) *ExportHandler {
	return &ExportHandler{DB: db}
}

type CSVReceiptRow struct {
	Vendor   string
	Amount   string
	Category string
	Date     string
	Status   string
}

func (h *ExportHandler) ExportCSV(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	ctx := context.Background()

	query := `SELECT vendor_name, amount, category, receipt_date, status
			  FROM receipts WHERE organization_id = $1`
	args := []interface{}{orgID}
	argIdx := 2

	if startDate != "" {
		t, err := time.Parse("2006-01-02", startDate)
		if err == nil {
			query += fmt.Sprintf(" AND receipt_date >= $%d", argIdx)
			args = append(args, t)
			argIdx++
		}
	}

	if endDate != "" {
		t, err := time.Parse("2006-01-02", endDate)
		if err == nil {
			query += fmt.Sprintf(" AND receipt_date <= $%d", argIdx)
			args = append(args, t)
			argIdx++
		}
	}

	query += " ORDER BY receipt_date DESC"

	rows, err := h.DB.Pool.Query(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query receipts for CSV export")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	writer.Write([]string{"Vendor", "Amount", "Category", "Date", "Status"})

	for rows.Next() {
		var vendor *string
		var amount *float64
		var category *string
		var date *time.Time
		var status string

		if err := rows.Scan(&vendor, &amount, &category, &date, &status); err != nil {
			log.Error().Err(err).Msg("Failed to scan receipt for CSV")
			continue
		}

		vendorStr := ""
		if vendor != nil {
			vendorStr = *vendor
		}

		amountStr := ""
		if amount != nil {
			amountStr = strconv.FormatFloat(*amount, 'f', 2, 64)
		}

		categoryStr := ""
		if category != nil {
			categoryStr = *category
		}

		dateStr := ""
		if date != nil {
			dateStr = date.Format("2006-01-02")
		}

		writer.Write([]string{vendorStr, amountStr, categoryStr, dateStr, status})
	}

	writer.Flush()

	filename := fmt.Sprintf("receipts_%s.csv", time.Now().Format("2006-01-02"))
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	return c.Send(buf.Bytes())
}

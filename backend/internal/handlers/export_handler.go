package handlers

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"
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

func (h *ExportHandler) ExportCSV(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	status := c.Query("status")

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

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query += " ORDER BY receipt_date DESC"

	rows, err := h.DB.Pool.Query(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query receipts for CSV export")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	filename := fmt.Sprintf("receipts_%s.csv", time.Now().Format("2006-01-02"))
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Set("Transfer-Encoding", "chunked")

	// Stream the CSV response
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		w.WriteString("Vendor,Amount,Category,Date,Status\n")
		w.Flush()

		for rows.Next() {
			var vendor *string
			var amount *float64
			var category *string
			var date *time.Time
			var status string

			if err := rows.Scan(&vendor, &amount, &category, &date, &status); err != nil {
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

			// Escape commas in fields
			if strings.Contains(vendorStr, ",") {
				vendorStr = fmt.Sprintf(`"%s"`, vendorStr)
			}
			if strings.Contains(categoryStr, ",") {
				categoryStr = fmt.Sprintf(`"%s"`, categoryStr)
			}

			w.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s\n", vendorStr, amountStr, categoryStr, dateStr, status))
			w.Flush()
		}
	})

	return nil
}

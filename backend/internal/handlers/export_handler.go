package handlers

import (
	"bufio"
	"context"
	"encoding/csv"
	"fmt"
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

	query := `SELECT
				id,
				COALESCE(NULLIF(vendor_name, ''), NULLIF(raw_vendor_name, ''), 'Unknown') AS export_vendor,
				COALESCE(amount, raw_amount, 0) AS export_amount,
				COALESCE(NULLIF(category, ''), NULLIF(raw_category, ''), 'Uncategorized') AS export_category,
				COALESCE(receipt_date, raw_date, created_at) AS export_date,
				COALESCE(confidence, raw_confidence, 0) AS export_confidence,
				status
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

	query += " ORDER BY COALESCE(receipt_date, raw_date, created_at) DESC"

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
		csvWriter := csv.NewWriter(w)
		_ = csvWriter.Write([]string{"Receipt ID", "Vendor", "Amount", "Category", "Date", "Confidence", "Status"})

		for rows.Next() {
			var id string
			var vendor string
			var amount float64
			var category string
			var date time.Time
			var confidence float64
			var status string

			if err := rows.Scan(&id, &vendor, &amount, &category, &date, &confidence, &status); err != nil {
				log.Error().Err(err).Msg("Failed to scan receipt for CSV export")
				continue
			}

			_ = csvWriter.Write([]string{
				id,
				vendor,
				fmt.Sprintf("%.2f", amount),
				category,
				date.Format("2006-01-02"),
				fmt.Sprintf("%.2f", confidence),
				status,
			})
		}
		csvWriter.Flush()
		w.Flush()
	})

	return nil
}

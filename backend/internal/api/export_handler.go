package api

import (
	"bufio"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/db"
)

type ExportHandler struct {
	DB *db.Database
}

func NewExportHandler(db *db.Database) *ExportHandler {
	return &ExportHandler{DB: db}
}

func (h *ExportHandler) ExportCSV(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	status := c.Query("status")
	userID := c.Locals("user_id").(string)

	ctx := context.Background()
	exportID := uuid.NewString()
	filename := fmt.Sprintf("receipts_%s.csv", time.Now().Format("2006-01-02"))
	filtersJSON, _ := json.Marshal(fiber.Map{"start_date": startDate, "end_date": endDate, "status": status})

	_, _ = h.DB.Pool.Exec(ctx,
		`INSERT INTO export_history (id, organization_id, user_id, export_type, filters, file_name)
		 VALUES ($1, $2, $3, 'csv', $4::jsonb, $5)`,
		exportID, orgID, userID, string(filtersJSON), filename,
	)

	query := `SELECT
				id,
				COALESCE(
					NULLIF(vendor_name, ''),
					NULLIF(raw_vendor_name, ''),
					NULLIF(ai_output->>'vendor_name', ''),
					NULLIF(raw_extraction->>'vendor_name', ''),
					'Unknown'
				) AS export_vendor,
				COALESCE(
					NULLIF(amount, 0),
					NULLIF(raw_amount, 0),
					CASE
						WHEN regexp_replace(COALESCE(ai_output->>'amount', ''), '[,$ ]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN regexp_replace(ai_output->>'amount', '[,$ ]', '', 'g')::numeric
					END,
					CASE
						WHEN regexp_replace(COALESCE(raw_extraction->>'amount', ''), '[,$ ]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN regexp_replace(raw_extraction->>'amount', '[,$ ]', '', 'g')::numeric
					END,
					0
				)::double precision AS export_amount,
				COALESCE(
					NULLIF(category, ''),
					NULLIF(raw_category, ''),
					NULLIF(ai_output->>'category', ''),
					NULLIF(raw_extraction->>'category', ''),
					'Uncategorized'
				) AS export_category,
				COALESCE(
					receipt_date,
					raw_date,
					CASE WHEN COALESCE(ai_output->>'receipt_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (ai_output->>'receipt_date')::date END,
					CASE WHEN COALESCE(ai_output->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (ai_output->>'date')::date END,
					CASE WHEN COALESCE(raw_extraction->>'receipt_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (raw_extraction->>'receipt_date')::date END,
					created_at
				) AS export_date,
				COALESCE(
					NULLIF(confidence, 0),
					NULLIF(raw_confidence, 0),
					CASE
						WHEN COALESCE(ai_output->>'confidence', '') ~ '^[0-9]+(\.[0-9]+)?$'
						THEN (ai_output->>'confidence')::double precision
					END,
					CASE
						WHEN COALESCE(raw_extraction->>'confidence', '') ~ '^[0-9]+(\.[0-9]+)?$'
						THEN (raw_extraction->>'confidence')::double precision
					END,
					0
				) AS export_confidence,
				status,
				COALESCE(NULLIF(currency, ''), 'USD') AS export_currency,
				COALESCE(NULLIF(source, ''), 'upload') AS export_source,
				COALESCE(NULLIF(file_name, ''), file_path, '') AS export_file_name,
				needs_review,
				created_at,
				COALESCE(updated_at, created_at) AS export_updated_at
			  FROM receipts WHERE organization_id = $1`
	args := []interface{}{orgID}
	argIdx := 2

	if startDate != "" {
		t, err := time.Parse("2006-01-02", startDate)
		if err == nil {
			query += fmt.Sprintf(" AND COALESCE(receipt_date, raw_date, created_at) >= $%d", argIdx)
			args = append(args, t)
			argIdx++
		}
	}

	if endDate != "" {
		t, err := time.Parse("2006-01-02", endDate)
		if err == nil {
			query += fmt.Sprintf(" AND COALESCE(receipt_date, raw_date, created_at) <= $%d", argIdx)
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

	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Set("Transfer-Encoding", "chunked")

	// Stream the CSV response
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer rows.Close()
		csvWriter := csv.NewWriter(w)
		_ = csvWriter.Write([]string{
			"Receipt ID",
			"Vendor",
			"Amount",
			"Currency",
			"Category",
			"Receipt Date",
			"Confidence %",
			"Status",
			"Source",
			"File Name",
			"Needs Review",
			"Created At",
			"Updated At",
		})

		rowCount := 0
		for rows.Next() {
			var id string
			var vendor string
			var amount float64
			var category string
			var date time.Time
			var confidence float64
			var status string
			var currency string
			var source string
			var fileName string
			var needsReview bool
			var createdAt time.Time
			var updatedAt time.Time

			if err := rows.Scan(
				&id,
				&vendor,
				&amount,
				&category,
				&date,
				&confidence,
				&status,
				&currency,
				&source,
				&fileName,
				&needsReview,
				&createdAt,
				&updatedAt,
			); err != nil {
				log.Error().Err(err).Msg("Failed to scan receipt for CSV export")
				continue
			}

			_ = csvWriter.Write([]string{
				id,
				vendor,
				fmt.Sprintf("%.2f", amount),
				currency,
				category,
				excelSafeDate(date),
				fmt.Sprintf("%.0f%%", confidence*100),
				status,
				source,
				fileName,
				fmt.Sprintf("%t", needsReview),
				excelSafeDateTime(createdAt),
				excelSafeDateTime(updatedAt),
			})
			rowCount++
		}
		_, _ = h.DB.Pool.Exec(context.Background(), "UPDATE export_history SET row_count = $1 WHERE id = $2", rowCount, exportID)
		csvWriter.Flush()
		w.Flush()
	})

	return nil
}

func (h *ExportHandler) History(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	ctx := context.Background()
	rows, err := h.DB.Pool.Query(ctx,
		`SELECT id, export_type, filters, row_count, COALESCE(file_name, ''), created_at
		 FROM export_history
		 WHERE organization_id = $1
		 ORDER BY created_at DESC
		 LIMIT 50`,
		orgID,
	)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to load export history")
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, exportType, filters, fileName string
		var rowCount int
		var createdAt time.Time
		if err := rows.Scan(&id, &exportType, &filters, &rowCount, &fileName, &createdAt); err != nil {
			continue
		}
		items = append(items, fiber.Map{
			"id": id, "export_type": exportType, "filters": json.RawMessage(filters),
			"row_count": rowCount, "file_name": fileName, "created_at": createdAt.Format(time.RFC3339),
		})
	}
	return c.JSON(SuccessResponse(items))
}

func excelSafeDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	// Prefix with a tab so Excel keeps the value readable instead of auto-rendering
	// narrow columns as #####. Other CSV readers trim/display the ISO value cleanly.
	return "\t" + t.Format("2006-01-02")
}

func excelSafeDateTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return "\t" + t.Format("2006-01-02 15:04:05")
}



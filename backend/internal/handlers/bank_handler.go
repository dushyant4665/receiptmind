package handlers

import (
	"context"
	"encoding/csv"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/services"
)

type BankHandler struct {
	DB           *database.Database
	AuditService *services.AuditService
}

func NewBankHandler(db *database.Database, auditSvc *services.AuditService) *BankHandler {
	return &BankHandler{DB: db, AuditService: auditSvc}
}

func (h *BankHandler) ImportCSV(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	userID := c.Locals("user_id").(string)
	file, err := c.FormFile("file")
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "file is required")
	}
	f, err := file.Open()
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "failed to read file")
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid csv")
	}
	if len(rows) < 2 {
		return SendError(c, fiber.StatusBadRequest, "csv has no transactions")
	}

	ctx := context.Background()
	importID := uuid.NewString()
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO bank_imports (id, organization_id, user_id, file_name, source, status, rows_total)
		 VALUES ($1, $2, $3, $4, 'csv', 'processing', $5)`,
		importID, orgID, userID, file.Filename, len(rows)-1,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create bank import")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	header := normalizeHeader(rows[0])
	imported := 0
	for _, row := range rows[1:] {
		txDate, desc, amount, currency, ok := parseBankRow(header, row)
		if !ok {
			continue
		}
		txID := uuid.NewString()
		_, err := h.DB.Pool.Exec(ctx,
			`INSERT INTO bank_transactions (id, organization_id, import_id, transaction_date, description, normalized_description, amount, currency)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			txID, orgID, importID, txDate, desc, normalizeText(desc), amount, currency,
		)
		if err == nil {
			imported++
			h.tryMatchReceipt(ctx, orgID, txID, txDate, desc, amount)
		}
	}

	_, _ = h.DB.Pool.Exec(ctx,
		`UPDATE bank_imports SET status = 'imported', rows_imported = $1, updated_at = NOW() WHERE id = $2`,
		imported, importID,
	)
	if h.AuditService != nil {
		h.AuditService.Log(ctx, orgID, userID, "bank.csv_imported", "bank_import", importID, c.IP(), c.Get("User-Agent"), "{}")
	}
	return c.JSON(SuccessResponse(fiber.Map{"id": importID, "rows_imported": imported}))
}

func (h *BankHandler) ListTransactions(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	status := c.Query("status")
	ctx := context.Background()

	query := `SELECT id, transaction_date, description, amount, currency, COALESCE(matched_receipt_id::text, ''), COALESCE(match_confidence, 0), status
	          FROM bank_transactions WHERE organization_id = $1 AND deleted_at IS NULL`
	args := []interface{}{orgID}
	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY transaction_date DESC LIMIT 100"

	rows, err := h.DB.Pool.Query(ctx, query, args...)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()
	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, desc, currency, matchedReceiptID, txStatus string
		var date time.Time
		var amount, confidence float64
		if err := rows.Scan(&id, &date, &desc, &amount, &currency, &matchedReceiptID, &confidence, &txStatus); err != nil {
			log.Error().Err(err).Msg("Failed to scan bank transaction")
			continue
		}
		items = append(items, fiber.Map{"id": id, "date": date.Format("2006-01-02"), "description": desc, "amount": amount, "currency": currency, "matched_receipt_id": matchedReceiptID, "match_confidence": confidence, "status": txStatus})
	}
	return c.JSON(SuccessResponse(items))
}

func (h *BankHandler) tryMatchReceipt(ctx context.Context, orgID, txID string, txDate time.Time, desc string, amount float64) {
	var receiptID string
	err := h.DB.Pool.QueryRow(ctx,
		`SELECT id FROM receipts
		 WHERE organization_id = $1
		   AND deleted_at IS NULL
		   AND amount BETWEEN $2 - 0.01 AND $2 + 0.01
		   AND receipt_date BETWEEN $3::date - INTERVAL '3 days' AND $3::date + INTERVAL '3 days'
		 ORDER BY CASE WHEN vendor_name ILIKE $4 THEN 0 ELSE 1 END, receipt_date DESC
		 LIMIT 1`,
		orgID, amount, txDate, "%"+desc+"%",
	).Scan(&receiptID)
	if err == nil {
		_, _ = h.DB.Pool.Exec(ctx,
			`UPDATE bank_transactions SET matched_receipt_id = $1, match_confidence = 0.86, status = 'matched', updated_at = NOW() WHERE id = $2`,
			receiptID, txID,
		)
	}
}

func normalizeHeader(row []string) map[string]int {
	out := map[string]int{}
	for i, h := range row {
		out[normalizeText(h)] = i
	}
	return out
}

func parseBankRow(header map[string]int, row []string) (time.Time, string, float64, string, bool) {
	dateValue := valueByAny(header, row, "date", "transaction date", "posted date")
	desc := valueByAny(header, row, "description", "merchant", "details", "narration")
	amountValue := valueByAny(header, row, "amount", "debit", "withdrawal")
	currency := valueByAny(header, row, "currency")
	if currency == "" {
		currency = "USD"
	}
	date, err := parseBankDate(dateValue)
	if err != nil || desc == "" || amountValue == "" {
		return time.Time{}, "", 0, "", false
	}
	amountValue = strings.ReplaceAll(strings.ReplaceAll(amountValue, ",", ""), "$", "")
	amount, err := strconv.ParseFloat(strings.TrimSpace(amountValue), 64)
	if err != nil {
		return time.Time{}, "", 0, "", false
	}
	return date, desc, amount, currency, true
}

func valueByAny(header map[string]int, row []string, keys ...string) string {
	for _, key := range keys {
		if idx, ok := header[normalizeText(key)]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
	}
	return ""
}

func parseBankDate(value string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02", "02/01/2006", "01/02/2006", time.RFC3339} {
		if t, err := time.Parse(layout, strings.TrimSpace(value)); err == nil {
			return t, nil
		}
	}
	return time.Time{}, io.EOF
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

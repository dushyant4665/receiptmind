package services

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/db"
	"receiptmind-backend/internal/models"
)

type ExceptionService struct {
	db *db.Database
}

func NewExceptionService(db *db.Database) *ExceptionService {
	return &ExceptionService{db: db}
}

func (e *ExceptionService) CheckAndCreate(ctx context.Context, receipt *models.Receipt, extraction *ExtractionResult) error {
	var exceptions []models.Exception

	if extraction.Confidence < 0.75 {
		exceptions = append(exceptions, models.Exception{
			ID:             uuid.New().String(),
			ReceiptID:      receipt.ID,
			OrganizationID: receipt.OrganizationID,
			Type:           "low_confidence",
			Field:          "confidence",
			Message:        fmt.Sprintf("AI confidence is %.2f, below threshold 0.75", extraction.Confidence),
			Status:         "open",
		})
	}

	if extraction.VendorName == "" {
		exceptions = append(exceptions, models.Exception{
			ID:             uuid.New().String(),
			ReceiptID:      receipt.ID,
			OrganizationID: receipt.OrganizationID,
			Type:           "missing_field",
			Field:          "vendor_name",
			Message:        "Vendor name could not be extracted",
			Status:         "open",
		})
	}

	if extraction.Amount == 0 {
		exceptions = append(exceptions, models.Exception{
			ID:             uuid.New().String(),
			ReceiptID:      receipt.ID,
			OrganizationID: receipt.OrganizationID,
			Type:           "missing_field",
			Field:          "amount",
			Message:        "Amount could not be extracted or is zero",
			Status:         "open",
		})
	}

	if extraction.ReceiptDate == "" {
		exceptions = append(exceptions, models.Exception{
			ID:             uuid.New().String(),
			ReceiptID:      receipt.ID,
			OrganizationID: receipt.OrganizationID,
			Type:           "missing_field",
			Field:          "receipt_date",
			Message:        "Receipt date could not be extracted",
			Status:         "open",
		})
	}

	if extraction.VendorName != "" && extraction.Amount > 0 {
		isDup, dupReceiptID := e.checkDuplicate(ctx, receipt.OrganizationID, extraction.VendorName, extraction.Amount, receipt.ID)
		if isDup {
			exceptions = append(exceptions, models.Exception{
				ID:             uuid.New().String(),
				ReceiptID:      receipt.ID,
				OrganizationID: receipt.OrganizationID,
				Type:           "duplicate",
				Field:          "amount",
				Message:        fmt.Sprintf("Possible duplicate of receipt %s (same vendor, similar amount)", dupReceiptID),
				Status:         "open",
			})
		}
	}

	for _, ex := range exceptions {
		_, err := e.db.Pool.Exec(ctx,
			`INSERT INTO exceptions (id, receipt_id, organization_id, type, field, message, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			ex.ID, ex.ReceiptID, ex.OrganizationID, ex.Type, ex.Field, ex.Message, ex.Status,
		)
		if err != nil {
			log.Error().Err(err).Str("exception_id", ex.ID).Msg("Failed to insert exception")
		}
	}

	if len(exceptions) > 0 {
		log.Info().Int("count", len(exceptions)).Str("receipt_id", receipt.ID).Msg("Exceptions created")
	}

	return nil
}

func (e *ExceptionService) checkDuplicate(ctx context.Context, orgID, vendorName string, amount float64, currentReceiptID string) (bool, string) {
	rows, err := e.db.Pool.Query(ctx,
		`SELECT id, amount FROM receipts
		 WHERE organization_id = $1 AND vendor_name = $2 AND id != $3 AND status = 'processed'
		 AND created_at > NOW() - INTERVAL '3 days'`,
		orgID, vendorName, currentReceiptID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check for duplicates")
		return false, ""
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var existingAmount float64
		if err := rows.Scan(&id, &existingAmount); err != nil {
			continue
		}
		if existingAmount > 0 && math.Abs(existingAmount-amount)/existingAmount <= 0.01 {
			return true, id
		}
	}

	return false, ""
}

func (e *ExceptionService) GetByOrganization(ctx context.Context, orgID string, status string) ([]models.Exception, error) {
	query := `SELECT id, receipt_id, organization_id, type, field, message, status, created_at
			  FROM exceptions WHERE organization_id = $1`
	args := []interface{}{orgID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	rows, err := e.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch exceptions: %w", err)
	}
	defer rows.Close()

	exceptions := make([]models.Exception, 0)
	for rows.Next() {
		var ex models.Exception
		if err := rows.Scan(&ex.ID, &ex.ReceiptID, &ex.OrganizationID, &ex.Type, &ex.Field, &ex.Message, &ex.Status, &ex.CreatedAt); err != nil {
			log.Error().Err(err).Msg("Failed to scan exception")
			continue
		}
		exceptions = append(exceptions, ex)
	}

	return exceptions, nil
}

func (e *ExceptionService) Resolve(ctx context.Context, exceptionID, orgID string) error {
	_, err := e.db.Pool.Exec(ctx,
		"UPDATE exceptions SET status = 'resolved' WHERE id = $1 AND organization_id = $2",
		exceptionID, orgID,
	)
	if err != nil {
		return fmt.Errorf("failed to resolve exception: %w", err)
	}
	return nil
}

func (e *ExceptionService) GetByReceiptID(ctx context.Context, receiptID, orgID string) ([]models.Exception, error) {
	rows, err := e.db.Pool.Query(ctx,
		`SELECT id, receipt_id, organization_id, type, field, message, status, created_at
		 FROM exceptions WHERE receipt_id = $1 AND organization_id = $2
		 ORDER BY created_at DESC`,
		receiptID, orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch exceptions for receipt: %w", err)
	}
	defer rows.Close()

	exceptions := make([]models.Exception, 0)
	for rows.Next() {
		var ex models.Exception
		if err := rows.Scan(&ex.ID, &ex.ReceiptID, &ex.OrganizationID, &ex.Type, &ex.Field, &ex.Message, &ex.Status, &ex.CreatedAt); err != nil {
			continue
		}
		exceptions = append(exceptions, ex)
	}

	return exceptions, nil
}



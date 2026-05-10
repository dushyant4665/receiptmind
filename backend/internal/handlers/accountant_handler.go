package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
)

type AccountantHandler struct {
	DB *database.Database
}

func NewAccountantHandler(db *database.Database) *AccountantHandler {
	return &AccountantHandler{DB: db}
}

func (h *AccountantHandler) ListClients(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	ctx := context.Background()

	rows, err := h.DB.Pool.Query(ctx,
		`SELECT o.id, o.name, o.slug,
		        COUNT(r.id) FILTER (WHERE r.status IN ('pending', 'processing')) AS processing_count,
		        COUNT(e.id) FILTER (WHERE e.status = 'open') AS open_exceptions,
		        COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'processed'), 0) AS processed_amount
		 FROM accountant_clients ac
		 JOIN organizations o ON o.id = ac.client_organization_id
		 LEFT JOIN receipts r ON r.organization_id = o.id AND r.deleted_at IS NULL
		 LEFT JOIN exceptions e ON e.organization_id = o.id AND e.status = 'open'
		 WHERE ac.accountant_user_id = $1 AND ac.deleted_at IS NULL
		 GROUP BY o.id, o.name, o.slug
		 ORDER BY open_exceptions DESC, o.name ASC`,
		userID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list accountant clients")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	clients := make([]fiber.Map, 0)
	for rows.Next() {
		var id, name, slug string
		var processingCount, openExceptions int
		var processedAmount float64
		if err := rows.Scan(&id, &name, &slug, &processingCount, &openExceptions, &processedAmount); err != nil {
			log.Error().Err(err).Msg("Failed to scan accountant client")
			continue
		}
		clients = append(clients, fiber.Map{
			"id":               id,
			"name":             name,
			"slug":             slug,
			"processing_count": processingCount,
			"open_exceptions":  openExceptions,
			"processed_amount": processedAmount,
		})
	}

	return c.JSON(SuccessResponse(clients))
}

func (h *AccountantHandler) ReviewQueue(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	ctx := context.Background()

	rows, err := h.DB.Pool.Query(ctx,
		`SELECT e.id, e.receipt_id, e.organization_id, o.name, e.type, e.field, e.message, e.created_at
		 FROM accountant_clients ac
		 JOIN organizations o ON o.id = ac.client_organization_id
		 JOIN exceptions e ON e.organization_id = o.id
		 WHERE ac.accountant_user_id = $1 AND ac.deleted_at IS NULL AND e.status = 'open'
		 ORDER BY e.created_at ASC
		 LIMIT 100`,
		userID,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to load accountant review queue")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, receiptID, orgID, orgName, typ, field, message string
		var createdAt time.Time
		if err := rows.Scan(&id, &receiptID, &orgID, &orgName, &typ, &field, &message, &createdAt); err != nil {
			log.Error().Err(err).Msg("Failed to scan accountant review queue")
			continue
		}
		items = append(items, fiber.Map{
			"id": id, "receipt_id": receiptID, "organization_id": orgID, "organization_name": orgName,
			"type": typ, "field": field, "message": message, "created_at": createdAt.Format(time.RFC3339),
		})
	}
	return c.JSON(SuccessResponse(items))
}

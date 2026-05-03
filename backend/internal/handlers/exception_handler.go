package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/models"
	"receiptmind-backend/internal/services"
)

type ExceptionHandler struct {
	DB               *database.Database
	ExceptionService *services.ExceptionService
	RuleService      *services.RuleService
}

func NewExceptionHandler(db *database.Database, exceptionSvc *services.ExceptionService, ruleSvc *services.RuleService) *ExceptionHandler {
	return &ExceptionHandler{
		DB:               db,
		ExceptionService: exceptionSvc,
		RuleService:      ruleSvc,
	}
}

func (h *ExceptionHandler) ListExceptions(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	status := c.Query("status")

	ctx := context.Background()

	exceptions, err := h.ExceptionService.GetByOrganization(ctx, orgID, status)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list exceptions")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	return c.JSON(SuccessResponse(exceptions))
}

func (h *ExceptionHandler) ResolveException(c *fiber.Ctx) error {
	exceptionID := c.Params("id")
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	var ex models.Exception
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, receipt_id, organization_id, status FROM exceptions WHERE id = $1 AND organization_id = $2",
		exceptionID, orgID,
	).Scan(&ex.ID, &ex.ReceiptID, &ex.OrganizationID, &ex.Status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return SendError(c, fiber.StatusNotFound, "exception not found")
		}
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}

	if ex.Status == "resolved" {
		return SendError(c, fiber.StatusBadRequest, "exception already resolved")
	}

	var req models.ResolveExceptionRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.VendorName != nil || req.Amount != nil || req.ReceiptDate != nil || req.Category != nil {
		setClauses := ""
		args := []interface{}{}
		argIdx := 1

		if req.VendorName != nil {
			setClauses += fmt.Sprintf("vendor_name = $%d, ", argIdx)
			args = append(args, *req.VendorName)
			argIdx++
		}
		if req.Amount != nil {
			setClauses += fmt.Sprintf("amount = $%d, ", argIdx)
			args = append(args, *req.Amount)
			argIdx++
		}
		if req.Category != nil {
			setClauses += fmt.Sprintf("category = $%d, ", argIdx)
			args = append(args, *req.Category)
			argIdx++
		}
		if req.ReceiptDate != nil {
			parsedDate, err := time.Parse("2006-01-02", *req.ReceiptDate)
			if err == nil {
				setClauses += fmt.Sprintf("receipt_date = $%d, ", argIdx)
				args = append(args, parsedDate)
				argIdx++
			}
		}

		if len(setClauses) > 0 {
			setClauses = setClauses[:len(setClauses)-2]
			args = append(args, ex.ReceiptID)
			query := fmt.Sprintf("UPDATE receipts SET %s WHERE id = $%d", setClauses, argIdx)
			if _, err := h.DB.Pool.Exec(ctx, query, args...); err != nil {
				log.Error().Err(err).Msg("Failed to update receipt on exception resolve")
			}

			if req.VendorName != nil && req.Category != nil {
				go h.RuleService.AutoLearnFromEdit(context.Background(), orgID, *req.VendorName, *req.Category)
			}
		}
	}

	if err := h.ExceptionService.Resolve(ctx, exceptionID, orgID); err != nil {
		log.Error().Err(err).Msg("Failed to resolve exception")
		return SendError(c, fiber.StatusInternalServerError, "failed to resolve exception")
	}

	return c.JSON(SuccessResponse(fiber.Map{"id": exceptionID, "status": "resolved"}))
}

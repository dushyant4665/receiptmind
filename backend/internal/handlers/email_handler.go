package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/services"
)

type EmailHandler struct {
	DB             *database.Database
	Config         *config.Config
	StorageService *services.StorageService
	QueueService   *services.QueueService
	QuotaService   *services.QuotaService
	AuditService   *services.AuditService
	Redis          *redis.Client
}

func NewEmailHandler(db *database.Database, cfg *config.Config, storageSvc *services.StorageService, queueSvc *services.QueueService, quotaSvc *services.QuotaService, auditSvc *services.AuditService, redisClient *redis.Client) *EmailHandler {
	return &EmailHandler{
		DB:             db,
		Config:         cfg,
		StorageService: storageSvc,
		QueueService:   queueSvc,
		QuotaService:   quotaSvc,
		AuditService:   auditSvc,
		Redis:          redisClient,
	}
}

type EmailInboundRequest struct {
	From        string            `json:"from"`
	Subject     string            `json:"subject"`
	MessageID   string            `json:"message_id"`
	Attachments []EmailAttachment `json:"attachments"`
}

type EmailAttachment struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

func (h *EmailHandler) Inbound(c *fiber.Ctx) error {
	// Validate webhook token
	token := c.Get("X-Webhook-Token")
	if token == "" {
		token = c.Query("token")
	}
	if token == "" || token != h.Config.EmailWebhookToken {
		return SendError(c, fiber.StatusUnauthorized, "invalid or missing webhook token")
	}
	if h.Config.EmailWebhookToken == "" {
		return SendError(c, fiber.StatusUnauthorized, "webhook not configured")
	}

	var req EmailInboundRequest
	if err := c.BodyParser(&req); err != nil {
		return SendError(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.From == "" {
		return SendError(c, fiber.StatusBadRequest, "from email is required")
	}

	if len(req.Attachments) == 0 {
		return SendError(c, fiber.StatusBadRequest, "no attachments found")
	}

	ctx := context.Background()

	var userID, orgID string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, organization_id FROM users WHERE email = $1",
		strings.ToLower(req.From),
	).Scan(&userID, &orgID)
	if err != nil {
		log.Warn().Str("email", req.From).Msg("Unknown sender email")
		return SendError(c, fiber.StatusNotFound, "sender not registered")
	}

	processedCount := 0

	for _, att := range req.Attachments {
		if h.QuotaService != nil {
			canProcess, used, limit := h.QuotaService.CanProcess(ctx, orgID)
			if !canProcess {
				log.Warn().Str("org_id", orgID).Int("used", used).Int("limit", limit).Msg("Email ingestion paused by quota")
				break
			}
		}

		ext := strings.ToLower(filepath.Ext(att.Filename))
		if !allowedExtensions[ext] {
			log.Warn().Str("filename", att.Filename).Msg("Skipping invalid file type from email")
			continue
		}

		if req.MessageID != "" {
			dedupHash := fmt.Sprintf("%x", sha256.Sum256([]byte(req.MessageID+att.Filename)))
			dedupKey := fmt.Sprintf("email_dedup:%s", dedupHash)
			set, err := h.Redis.SetNX(ctx, dedupKey, "1", 1*time.Hour).Result()
			if err == nil && !set {
				log.Warn().Str("filename", att.Filename).Msg("Duplicate email attachment, skipping")
				continue
			}
		}

		fileData, err := base64.StdEncoding.DecodeString(att.Content)
		if err != nil {
			log.Warn().Str("filename", att.Filename).Err(err).Msg("Failed to decode base64 attachment")
			continue
		}

		if int64(len(fileData)) > h.Config.MaxFileSize {
			log.Warn().Str("filename", att.Filename).Msg("Attachment exceeds size limit")
			continue
		}

		filePath, err := h.StorageService.UploadFile(fileData, att.Filename, orgID)
		if err != nil {
			log.Error().Err(err).Str("filename", att.Filename).Msg("Failed to upload email attachment")
			continue
		}

		// Generate file hash for duplicate detection
		fileHash := fmt.Sprintf("%x", sha256.Sum256(fileData))

		receiptID := uuid.New().String()
		// Generate Base64 for persistent storage (same as upload handler)
		mimeType := http.DetectContentType(fileData)
		base64Data := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(fileData)
		_, err = h.DB.Pool.Exec(ctx,
			`INSERT INTO receipts (id, organization_id, user_id, file_path, file_url, file_name, file_hash, status, processing_state, currency, line_items, is_billable, is_reimbursable, needs_review, source, raw_extraction, user_corrections, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'queued', 'USD', '[]'::jsonb, false, false, false, 'email', '{}'::jsonb, '{}'::jsonb, NOW())`,
			receiptID, orgID, userID, filePath, base64Data, att.Filename, fileHash,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to insert receipt from email")
			continue
		}
		_, _ = h.DB.Pool.Exec(ctx,
			`INSERT INTO storage_objects (id, organization_id, receipt_id, path, file_hash, size_bytes, content_type)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (path) DO NOTHING`,
			uuid.NewString(), orgID, receiptID, filePath, fileHash, len(fileData), mimeType,
		)
		h.invalidateCache(ctx, orgID)

		err = h.QueueService.EnqueueWithPriority(ctx, "process_receipt", map[string]interface{}{
			"receipt_id":      receiptID,
			"file_url":        filePath,
			"org_id":          orgID,
			"idempotency_key": fmt.Sprintf("email:%s:%s", req.MessageID, fileHash),
		}, "high")
		if err != nil {
			log.Error().Err(err).Msg("Failed to enqueue email receipt job")
			continue
		}
		_, _ = h.DB.Pool.Exec(ctx,
			`INSERT INTO receipt_processing_jobs (id, receipt_id, organization_id, processing_state)
			 VALUES ($1, $2, $3, 'queued')`,
			uuid.NewString(), receiptID, orgID,
		)
		if h.AuditService != nil {
			h.AuditService.Log(ctx, orgID, userID, "receipt.email_received", "receipt", receiptID, c.IP(), c.Get("User-Agent"), "{}")
		}

		processedCount++
		log.Info().
			Str("from", req.From).
			Str("filename", att.Filename).
			Str("receipt_id", receiptID).
			Msg("Email attachment processed")
	}

	return c.JSON(SuccessResponse(fiber.Map{
		"processed": processedCount,
	}))
}

func (h *EmailHandler) Inbox(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	orgID := c.Locals("organization_id").(string)

	ctx := context.Background()

	var userEmail string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT email FROM users WHERE id = $1",
		userID,
	).Scan(&userEmail)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch user email for inbox")
		return SendError(c, fiber.StatusInternalServerError, "failed to get inbox")
	}

	inboxEmail := fmt.Sprintf("inbox+%s@receiptmind.app", orgID[:8])

	return c.JSON(SuccessResponse(fiber.Map{
		"email": inboxEmail,
	}))
}

func (h *EmailHandler) invalidateCache(ctx context.Context, orgID string) {
	h.Redis.Del(ctx, fmt.Sprintf("dashboard:%s", orgID))
	iter := h.Redis.Scan(ctx, 0, fmt.Sprintf("receipts:%s:*", orgID), 100).Iterator()
	for iter.Next(ctx) {
		h.Redis.Del(ctx, iter.Val())
	}
}

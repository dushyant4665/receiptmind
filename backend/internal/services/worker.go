package services

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/db"
	"receiptmind-backend/internal/models"
)

const maxRetries = 3

type Worker struct {
	queue            *QueueService
	db               *db.Database
	aiService        *AIService
	exceptionService *ExceptionService
	ruleService      *RuleService
	storageService   *StorageService
	redis            *redis.Client
	concurrency      int
	aiLimiter        chan struct{}
}

func NewWorker(queue *QueueService, db *db.Database, aiSvc *AIService, exceptionSvc *ExceptionService, ruleSvc *RuleService, storageSvc *StorageService, redisClient *redis.Client, concurrency int) *Worker {
	if concurrency < 1 {
		concurrency = 5
	}
	aiConcurrency := concurrency
	if aiConcurrency > 5 {
		aiConcurrency = 5
	}
	return &Worker{
		queue:            queue,
		db:               db,
		aiService:        aiSvc,
		exceptionService: exceptionSvc,
		ruleService:      ruleSvc,
		storageService:   storageSvc,
		redis:            redisClient,
		concurrency:      concurrency,
		aiLimiter:        make(chan struct{}, aiConcurrency),
	}
}

func (w *Worker) Start(ctx context.Context) {
	log.Info().Int("concurrency", w.concurrency).Msg("Worker pool started")

	var wg sync.WaitGroup
	sem := make(chan struct{}, w.concurrency)

	for {
		select {
		case <-ctx.Done():
			wg.Wait()
			log.Info().Msg("Worker pool stopped")
			return
		default:
		}

		job, err := w.queue.Dequeue(ctx)
		if err != nil {
			if ctx.Err() != nil {
				wg.Wait()
				return
			}
			if err == redis.Nil {
				continue
			}
			log.Warn().Err(err).Msg("Failed to dequeue job")
			continue
		}

		sem <- struct{}{}
		wg.Add(1)

		go func(j *QueueJob) {
			defer func() {
				<-sem
				wg.Done()
			}()

			start := time.Now()
			log.Info().Str("job_id", j.ID).Str("type", j.Type).Int("attempt", j.Attempts).Msg("Processing job")

			switch j.Type {
			case "process_receipt":
				receiptID, ok := j.Payload["receipt_id"].(string)
				if !ok {
					log.Error().Msg("Invalid receipt_id in job payload")
					return
				}
				w.processReceipt(ctx, receiptID, j)
			default:
				log.Warn().Str("type", j.Type).Msg("Unknown job type")
			}
			log.Info().Str("job_id", j.ID).Dur("duration", time.Since(start)).Msg("Job finished")
		}(job)
	}
}

func (w *Worker) processReceipt(ctx context.Context, receiptID string, job *QueueJob) {
	var status string
	err := w.db.Pool.QueryRow(ctx,
		"SELECT status FROM receipts WHERE id = $1",
		receiptID,
	).Scan(&status)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to check receipt status")
		w.queue.EnqueueDeadLetter(ctx, job, "receipt not found")
		return
	}

	if status == "processed" {
		log.Warn().Str("receipt_id", receiptID).Msg("Receipt already processed, skipping (idempotency)")
		return
	}

	if status == "processing" && job.Attempts > 0 {
		log.Warn().Str("receipt_id", receiptID).Int("attempts", job.Attempts).Msg("Receipt stuck in processing, retrying")
	}

	_, err = w.db.Pool.Exec(ctx,
		"UPDATE receipts SET status = 'processing', processing_state = 'processing', processing_started_at = COALESCE(processing_started_at, NOW()), updated_at = NOW() WHERE id = $1",
		receiptID,
	)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to update status to processing")
		w.handleFailure(ctx, receiptID, job, err)
		return
	}

	log.Debug().Str("receipt_id", receiptID).Msg("Worker: Receipt status updated to processing")
	_, _ = w.db.Pool.Exec(ctx,
		`UPDATE receipt_processing_jobs
		 SET processing_state = 'processing', attempts = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW(), queue_job_id = $2
		 WHERE receipt_id = $3 AND processing_state IN ('queued', 'processing')`,
		job.Attempts+1, job.ID, receiptID,
	)

	var receipt models.Receipt
	var fileName string
	err = w.db.Pool.QueryRow(ctx,
		"SELECT id, organization_id, user_id, file_path, COALESCE(file_name, '') FROM receipts WHERE id = $1",
		receiptID,
	).Scan(&receipt.ID, &receipt.OrganizationID, &receipt.UserID, &receipt.FilePath, &fileName)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to fetch receipt")
		w.handleFailure(ctx, receiptID, job, err)
		return
	}

	log.Debug().Str("receipt_id", receiptID).Str("file_path", receipt.FilePath).Msg("Worker: Processing file")

	fileBytes, err := w.storageService.DownloadFile(ctx, receipt.FilePath)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to download file from storage")
		w.handleFailure(ctx, receiptID, job, err)
		return
	}

	if fileName == "" {
		fileName = receipt.FilePath
	}
	w.aiLimiter <- struct{}{}
	pipeline := NewExtractionPipeline(w.aiService.config)
	extraction, err := pipeline.Process(ctx, fileBytes, fileName)
	<-w.aiLimiter
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("AI extraction failed")
		w.handleFailure(ctx, receiptID, job, err)
		return
	}

	extraction = w.ruleService.ApplyRules(ctx, receipt.OrganizationID, extraction)

	parsedDate, dateErr := parseDate(extraction.ReceiptDate)
	if dateErr != nil {
		log.Warn().Str("raw_date", extraction.ReceiptDate).Msg("Failed to parse receipt date from AI")
	}

	rawVendor := extraction.VendorName
	rawAmount := extraction.Amount
	rawCategory := extraction.Category
	rawConfidence := extraction.Confidence

	vendorName := rawVendor
	amount := rawAmount
	category := rawCategory
	confidence := rawConfidence
	needsReview := confidence < 0.75 || vendorName == "" || amount <= 0 || extraction.ReceiptDate == ""
	valConfidence := validationConfidence(extraction)
	combinedConfidence := finalConfidence(confidence, valConfidence)
	newStatus := "processed"
	if needsReview {
		newStatus = "needs_review"
	}

	_, err = w.db.Pool.Exec(ctx,
		`UPDATE receipts SET
			status = $1,
			raw_vendor_name = $2,
			raw_amount = $3,
			raw_date = $4,
			raw_category = $5,
			raw_confidence = $6,
			vendor_name = $7,
			amount = $8,
			receipt_date = $9,
			category = $10,
			confidence = $11,
			validation_confidence = $12,
			final_confidence = $13,
			needs_review = $14,
			raw_text = $15,
			ai_output = COALESCE($16::jsonb, '{}'::jsonb),
			processing_state = $17,
			processing_finished_at = NOW(),
			updated_at = NOW()
		WHERE id = $18`,
		newStatus,
		nullStr(rawVendor), rawAmount, parsedDate, nullStr(rawCategory), rawConfidence,
		nullStr(vendorName), amount, parsedDate, nullStr(category), confidence,
		valConfidence, combinedConfidence,
		needsReview, extraction.RawText, extraction.AIOutput, newStatus,
		receiptID,
	)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to update receipt with extracted data")
		w.handleFailure(ctx, receiptID, job, err)
		return
	}

	if err := w.exceptionService.CheckAndCreate(ctx, &receipt, extraction); err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Exception check failed")
	}
	_, _ = w.db.Pool.Exec(ctx,
		`UPDATE receipt_processing_jobs
		 SET processing_state = $1, finished_at = NOW(), updated_at = NOW()
		 WHERE receipt_id = $2 AND processing_state = 'processing'`,
		newStatus, receiptID,
	)

	// Invalidate caches for this org
	if w.redis != nil {
		w.redis.Del(ctx, fmt.Sprintf("dashboard:%s", receipt.OrganizationID))
		iter := w.redis.Scan(ctx, 0, fmt.Sprintf("receipts:%s:*", receipt.OrganizationID), 100).Iterator()
		for iter.Next(ctx) {
			w.redis.Del(ctx, iter.Val())
		}
	}

	log.Info().
		Str("receipt_id", receiptID).
		Str("vendor", vendorName).
		Str("amount", strconv.FormatFloat(amount, 'f', 2, 64)).
		Float64("confidence", confidence).
		Msg("Receipt processed successfully")
}

func (w *Worker) handleFailure(ctx context.Context, receiptID string, job *QueueJob, err error) {
	job.Attempts++
	job.LastError = err.Error()
	limit := job.MaxAttempts
	if limit == 0 {
		limit = maxRetries
	}
	if job.Attempts >= limit {
		w.markFailed(ctx, receiptID)
		_, _ = w.db.Pool.Exec(ctx,
			`UPDATE receipt_processing_jobs SET processing_state = 'failed', attempts = $1, last_error = $2, finished_at = NOW(), updated_at = NOW() WHERE receipt_id = $3`,
			job.Attempts, job.LastError, receiptID,
		)
		w.queue.EnqueueDeadLetter(ctx, job, err.Error())
		return
	}

	backoff := time.Duration(job.Attempts*job.Attempts) * 5 * time.Second
	log.Warn().
		Str("receipt_id", receiptID).
		Int("attempt", job.Attempts).
		Dur("backoff", backoff).
		Msg("Job failed, re-enqueuing with backoff")

	_ = w.queue.EnqueueDelayed(ctx, job, backoff)
	_, _ = w.db.Pool.Exec(ctx,
		`UPDATE receipt_processing_jobs SET processing_state = 'retrying', attempts = $1, last_error = $2, updated_at = NOW() WHERE receipt_id = $3`,
		job.Attempts, job.LastError, receiptID,
	)
}

func (w *Worker) markFailed(ctx context.Context, receiptID string) {
	_, err := w.db.Pool.Exec(ctx,
		"UPDATE receipts SET status = 'failed', processing_state = 'failed', processing_finished_at = NOW(), updated_at = NOW() WHERE id = $1",
		receiptID,
	)
	if err != nil {
		log.Error().Err(err).Str("receipt_id", receiptID).Msg("Failed to mark receipt as failed")
	}
}

func parseDate(dateStr string) (*time.Time, error) {
	if dateStr == "" {
		return nil, fmt.Errorf("empty date string")
	}

	formats := []string{
		"2006-01-02",
		"01/02/2006",
		"02/01/2006",
		time.RFC3339,
	}

	for _, f := range formats {
		if t, err := time.Parse(f, dateStr); err == nil {
			return &t, nil
		}
	}

	return nil, fmt.Errorf("unparseable date: %s", dateStr)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func validationConfidence(extraction *ExtractionResult) float64 {
	score := 1.0
	if extraction.VendorName == "" {
		score -= 0.25
	}
	if extraction.Amount <= 0 {
		score -= 0.35
	}
	if extraction.ReceiptDate == "" {
		score -= 0.25
	}
	if extraction.Category == "" || extraction.Category == "General" {
		score -= 0.10
	}
	if score < 0 {
		return 0
	}
	return score
}

func finalConfidence(aiConfidence, validationConfidence float64) float64 {
	final := (aiConfidence * 0.7) + (validationConfidence * 0.3)
	if final < 0 {
		return 0
	}
	if final > 1 {
		return 1
	}
	return final
}



package api

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/db"
)

type MetricsHandler struct {
	DB *db.Database
}

func NewMetricsHandler(db *db.Database) *MetricsHandler {
	return &MetricsHandler{DB: db}
}

type ProcessingTimeMetrics struct {
	AverageSeconds float64          `json:"average_seconds"`
	FastestSeconds float64          `json:"fastest_seconds"`
	SlowestSeconds float64          `json:"slowest_seconds"`
	RecentStats    []ProcessingStat `json:"recent_stats"`
}

type ProcessingStat struct {
	ID              string  `json:"id"`
	VendorName      string  `json:"vendor_name"`
	DurationSeconds float64 `json:"duration_seconds"`
	OCRTimeSeconds  float64 `json:"ocr_time_seconds,omitempty"`
	AITimeSeconds   float64 `json:"ai_time_seconds,omitempty"`
}

type ProcessingMetricsResponse struct {
	AverageSeconds float64 `json:"average_seconds"`
	MinSeconds     float64 `json:"min_seconds"`
	MaxSeconds     float64 `json:"max_seconds"`
	Count          int     `json:"count"`
}

func (h *MetricsHandler) GetProcessingTimes(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	ctx := context.Background()

	query := `
		SELECT 
			EXTRACT(EPOCH FROM (processing_finished_at - processing_started_at)) as duration
		FROM receipts 
		WHERE organization_id = $1 
		  AND status = 'processed' 
		  AND processing_started_at IS NOT NULL 
		  AND processing_finished_at IS NOT NULL
		ORDER BY processing_finished_at DESC
		LIMIT 30
	`

	rows, err := h.DB.Pool.Query(ctx, query, orgID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query processing times")
		return SendError(c, fiber.StatusInternalServerError, "internal server error")
	}
	defer rows.Close()

	var totalDuration float64
	var minDuration float64 = -1
	var maxDuration float64 = 0
	var count int

	for rows.Next() {
		var duration float64
		if err := rows.Scan(&duration); err != nil {
			continue
		}

		totalDuration += duration
		if minDuration == -1 || duration < minDuration {
			minDuration = duration
		}
		if duration > maxDuration {
			maxDuration = duration
		}
		count++
	}

	if count == 0 {
		return c.JSON(SuccessResponse(ProcessingMetricsResponse{
			AverageSeconds: 0,
			MinSeconds:     0,
			MaxSeconds:     0,
			Count:          0,
		}))
	}

	avg := totalDuration / float64(count)

	return c.JSON(SuccessResponse(ProcessingMetricsResponse{
		AverageSeconds: avg,
		MinSeconds:     minDuration,
		MaxSeconds:     maxDuration,
		Count:          count,
	}))
}



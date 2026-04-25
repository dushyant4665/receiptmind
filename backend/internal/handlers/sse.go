package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/database"
)

type SSEHandler struct {
	db         *database.PostgresDB
	redisCache *cache.RedisCache
	clients    map[string]map[chan string]bool
}

func NewSSEHandler(db *database.PostgresDB, redisCache *cache.RedisCache) *SSEHandler {
	return &SSEHandler{
		db:         db,
		redisCache: redisCache,
		clients:    make(map[string]map[chan string]bool),
	}
}

type ExtractionStatus struct {
	ReceiptID   string    `json:"receipt_id"`
	Status      string    `json:"status"`
	Progress    int       `json:"progress"`
	VendorName  string    `json:"vendor_name,omitempty"`
	Amount      float64   `json:"amount,omitempty"`
	Category    string    `json:"category,omitempty"`
	Confidence  float64   `json:"confidence,omitempty"`
	NeedsReview bool      `json:"needs_review"`
	ExceptionID string    `json:"exception_id,omitempty"`
	Message     string    `json:"message,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

func (h *SSEHandler) Stream(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	receiptID := c.Query("receipt_id", "")
	if receiptID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "receipt_id required"})
	}

	if _, err := uuid.Parse(receiptID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid receipt_id"})
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		clientChan := make(chan string, 10)

		if _, ok := h.clients[userID]; !ok {
			h.clients[userID] = make(map[chan string]bool)
		}
		h.clients[userID][clientChan] = true

		defer func() {
			delete(h.clients[userID], clientChan)
			close(clientChan)
		}()

		initialStatus, err := h.getReceiptStatus(receiptID, userID)
		if err == nil && initialStatus != nil {
			data, _ := json.Marshal(initialStatus)
			fmt.Fprintf(w, "data: %s\n\n", data)
			w.Flush()
		}

		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		timeout := time.NewTimer(5 * time.Minute)
		defer timeout.Stop()

		for {
			select {
			case msg := <-clientChan:
				fmt.Fprintf(w, "data: %s\n\n", msg)
				w.Flush()

			case <-ticker.C:
				status, err := h.getReceiptStatus(receiptID, userID)
				if err != nil {
					continue
				}

				if status != nil {
					data, _ := json.Marshal(status)
					fmt.Fprintf(w, "data: %s\n\n", data)
					w.Flush()

					if status.Status == "extracted" || status.Status == "categorized" ||
						status.Status == "posted" || status.Status == "error" {
						return
					}
				}

			case <-timeout.C:
				fmt.Fprintf(w, "data: {\"status\":\"timeout\",\"message\":\"Stream timeout\"}\n\n")
				w.Flush()
				return

			case <-c.Context().Done():
				return
			}
		}
	})

	return nil
}

func (h *SSEHandler) getReceiptStatus(receiptID, userID string) (*ExtractionStatus, error) {
	query := `
		SELECT r.id, r.status, r.vendor_name, r.amount, r.category, 
		       r.extraction_confidence, r.needs_review, e.id as exception_id
		FROM receipts r
		LEFT JOIN exceptions e ON r.id = e.receipt_id AND e.status = 'open'
		WHERE r.id = $1 AND r.user_id = $2`

	var status ExtractionStatus
	var vendorName, category nullString
	var amount, confidence nullFloat64
	var exceptionID nullString
	var needsReview bool

	err := h.db.DB.QueryRow(query, receiptID, userID).Scan(
		&status.ReceiptID, &status.Status, &vendorName, &amount, &category,
		&confidence, &needsReview, &exceptionID,
	)
	if err != nil {
		return nil, err
	}

	if vendorName.Valid {
		status.VendorName = vendorName.String
	}
	if amount.Valid {
		status.Amount = amount.Float64
	}
	if category.Valid {
		status.Category = category.String
	}
	if confidence.Valid {
		status.Confidence = confidence.Float64
	}
	if exceptionID.Valid {
		status.ExceptionID = exceptionID.String
	}
	status.NeedsReview = needsReview
	status.Timestamp = time.Now()

	switch status.Status {
	case "pending":
		status.Progress = 10
		status.Message = "Queued for processing"
	case "extracting":
		status.Progress = 40
		status.Message = "AI extracting data..."
	case "extracted":
		status.Progress = 70
		status.Message = "Data extracted, categorizing..."
	case "categorized":
		status.Progress = 90
		status.Message = "Categorized"
	case "posted":
		status.Progress = 100
		status.Message = "Posted to accounting system"
	case "error":
		status.Progress = 0
		status.Message = "Processing failed"
	}

	return &status, nil
}

func (h *SSEHandler) Broadcast(userID string, status *ExtractionStatus) {
	if clients, ok := h.clients[userID]; ok {
		data, _ := json.Marshal(status)
		for client := range clients {
			select {
			case client <- string(data):
			default:
			}
		}
	}
}

type nullString struct {
	String string
	Valid  bool
}

type nullFloat64 struct {
	Float64 float64
	Valid   bool
}

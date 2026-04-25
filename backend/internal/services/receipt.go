package services

import (
	"context"

	"github.com/receiptmind/backend/internal/models"
)

type ReceiptService struct {
	openAI *OpenAIService
}

func NewReceiptService(openAI *OpenAIService) *ReceiptService {
	return &ReceiptService{openAI: openAI}
}

func (s *ReceiptService) Extract(ctx context.Context, imageURL string) (*models.ReceiptExtractionResult, error) {
	return s.openAI.ExtractReceiptData(ctx, imageURL)
}

package services

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
	"receiptmind-backend/internal/config"
)

type ExtractionPipeline struct {
	config     *config.Config
	aiService  *AIService
	ocrService *OCRService
	pdfService *PDFService
}

func NewExtractionPipeline(cfg *config.Config) *ExtractionPipeline {
	return &ExtractionPipeline{
		config:     cfg,
		aiService:  NewAIService(cfg),
		ocrService: NewOCRService(),
		pdfService: NewPDFService(),
	}
}

func (p *ExtractionPipeline) Process(ctx context.Context, data []byte, fileName string) (*ExtractionResult, error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	var images [][]byte
	var err error

	// 1. PDF Handling
	if ext == ".pdf" {
		log.Info().Msg("Processing PDF file")
		images, err = p.pdfService.ConvertPDFToImages(data)
		if err != nil {
			return nil, fmt.Errorf("pdf conversion failed: %w", err)
		}
	} else {
		// Image Handling
		images = [][]byte{data}
	}

	// 2. Preprocessing & OCR (for the first page/image primarily)
	if len(images) == 0 {
		return nil, fmt.Errorf("no images found for processing")
	}

	// We focus on the first page for most receipts
	targetImg := images[0]
	
	// 3. OCR Extraction (Free + Reliable)
	ocrText, err := p.ocrService.ExtractText(targetImg)
	if err != nil {
		log.Warn().Err(err).Msg("OCR failed, falling back to pure AI image processing")
	}

	// 4. AI Extraction with Fallback
	result, err := p.aiService.ExtractWithContext(ctx, targetImg, ocrText)
	if err != nil || result.Confidence < 0.6 {
		log.Warn().Err(err).Float64("confidence", result.Confidence).Msg("AI low confidence or failed, retrying...")
		// Retry once with more descriptive prompt or 1.5 Pro
		result, err = p.aiService.ExtractWithContext(ctx, targetImg, ocrText)
	}

	if err != nil {
		return nil, fmt.Errorf("ai extraction failed after retry: %w", err)
	}

	return result, nil
}

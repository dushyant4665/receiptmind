package services

import (
	"github.com/rs/zerolog/log"
)

type OCRService struct{}

func NewOCRService() *OCRService {
	return &OCRService{}
}

func (s *OCRService) ExtractText(imageData []byte) (string, error) {
	log.Info().Int("bytes", len(imageData)).Msg("Starting OCR text extraction")
	
	// Implementation note: 
	// For high-scale production, use Tesseract Go bindings or a cloud OCR.
	// Gemini 2.0 Flash actually has very strong built-in OCR capability, 
	// so we will pass the image to Gemini as the primary OCR engine.
	
	return "", nil // Return empty to let AI handle visual OCR if local OCR is not installed
}

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

const (
	fileTypeImage = "image"
	fileTypePDF   = "pdf"
	maxImageWidth = 1400
	maxPDFPages   = 5
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
	processCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	fileType, err := detectReceiptFileType(data, fileName)
	if err != nil {
		return nil, err
	}

	var images [][]byte
	switch fileType {
	case fileTypePDF:
		images, err = p.pdfService.ConvertPDFToImages(processCtx, data)
		if err != nil {
			log.Warn().Err(err).Msg("PDF conversion failed; receipt will require review")
			return reviewResult("", fmt.Sprintf("pdf_conversion_failed: %v", err)), nil
		}
	case fileTypeImage:
		images = [][]byte{data}
	default:
		return nil, fmt.Errorf("unsupported file type: %s", fileType)
	}

	if len(images) == 0 {
		return reviewResult("", "no_images_to_process"), nil
	}
	if len(images) > maxPDFPages {
		images = images[:maxPDFPages]
	}

	var best *ExtractionResult
	var allText []string
	var lastErr error

	for pageIndex, img := range images {
		preprocessed, err := preprocessImage(img)
		if err != nil {
			log.Warn().Err(err).Int("page", pageIndex+1).Msg("Image preprocessing failed; using original image")
			preprocessed = img
		}

		ocrText, err := p.ocrService.ExtractText(processCtx, preprocessed)
		if err != nil {
			log.Warn().Err(err).Int("page", pageIndex+1).Msg("OCR failed; falling back to AI image input")
		}
		if ocrText != "" {
			allText = append(allText, ocrText)
		}

		result, err := p.extractWithRetry(processCtx, preprocessed, ocrText)
		if err != nil {
			lastErr = err
			log.Warn().Err(err).Int("page", pageIndex+1).Msg("AI extraction failed for page")
			continue
		}

		result.RawText = strings.TrimSpace(strings.Join(allText, "\n\n--- PAGE ---\n\n"))
		if isBetterExtraction(result, best) {
			best = result
		}
	}

	if best != nil {
		if best.RawText == "" {
			best.RawText = strings.TrimSpace(strings.Join(allText, "\n\n--- PAGE ---\n\n"))
		}
		return best, nil
	}

	rawText := strings.TrimSpace(strings.Join(allText, "\n\n--- PAGE ---\n\n"))
	if lastErr != nil {
		return reviewResult(rawText, fmt.Sprintf("ai_failed: %v", lastErr)), nil
	}
	return reviewResult(rawText, "no_extraction_result"), nil
}

func (p *ExtractionPipeline) extractWithRetry(ctx context.Context, imageData []byte, ocrText string) (*ExtractionResult, error) {
	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		result, err := p.aiService.ExtractWithContext(ctx, imageData, ocrText)
		if err == nil && result != nil {
			if result.Confidence >= 0.6 || attempt == 2 {
				return result, nil
			}
			lastErr = fmt.Errorf("low confidence %.2f", result.Confidence)
			continue
		}
		lastErr = err
	}
	return nil, lastErr
}

func detectReceiptFileType(data []byte, fileName string) (string, error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	if len(data) >= 4 && string(data[:4]) == "%PDF" {
		return fileTypePDF, nil
	}
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return fileTypeImage, nil
	}
	if len(data) >= 8 && bytes.Equal(data[:8], []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) {
		return fileTypeImage, nil
	}

	switch ext {
	case ".jpg", ".jpeg", ".png":
		return fileTypeImage, nil
	case ".pdf":
		return fileTypePDF, nil
	default:
		return "", fmt.Errorf("unsupported file type")
	}
}

func preprocessImage(data []byte) ([]byte, error) {
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}
	_ = format

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return nil, fmt.Errorf("invalid image dimensions")
	}

	targetWidth := width
	targetHeight := height
	if width > maxImageWidth {
		targetWidth = maxImageWidth
		targetHeight = int(float64(height) * (float64(maxImageWidth) / float64(width)))
	}

	processed := image.NewGray(image.Rect(0, 0, targetWidth, targetHeight))
	for y := 0; y < targetHeight; y++ {
		srcY := bounds.Min.Y + y*height/targetHeight
		for x := 0; x < targetWidth; x++ {
			srcX := bounds.Min.X + x*width/targetWidth
			gray := color.GrayModel.Convert(img.At(srcX, srcY)).(color.Gray)
			// Gentle contrast lift for receipt text while avoiding blown-out paper.
			v := int(gray.Y)
			if v > 245 {
				v = 255
			} else if v < 30 {
				v = 0
			} else {
				v = int(float64(v-30) * 255.0 / 215.0)
				if v < 0 {
					v = 0
				}
				if v > 255 {
					v = 255
				}
			}
			processed.SetGray(x, y, color.Gray{Y: uint8(v)})
		}
	}

	var out bytes.Buffer
	if err := jpeg.Encode(&out, processed, &jpeg.Options{Quality: 82}); err != nil {
		return nil, fmt.Errorf("encode preprocessed image: %w", err)
	}
	return out.Bytes(), nil
}

func reviewResult(rawText, reason string) *ExtractionResult {
	payload, _ := json.Marshal(map[string]string{"status": "needs_review", "reason": reason})
	return &ExtractionResult{
		Category:   "General",
		Confidence: 0,
		RawText:    rawText,
		AIOutput:   string(payload),
	}
}

func isBetterExtraction(candidate, current *ExtractionResult) bool {
	if current == nil {
		return true
	}
	candidateScore := extractionScore(candidate)
	currentScore := extractionScore(current)
	return candidateScore > currentScore
}

func extractionScore(result *ExtractionResult) float64 {
	score := result.Confidence
	if result.VendorName != "" {
		score += 0.2
	}
	if result.Amount > 0 {
		score += 0.25
	}
	if result.ReceiptDate != "" {
		score += 0.15
	}
	if result.Category != "" && result.Category != "General" {
		score += 0.05
	}
	return score
}

func init() {
	image.RegisterFormat("jpeg", "\xff\xd8", jpeg.Decode, jpeg.DecodeConfig)
	image.RegisterFormat("png", "\x89PNG\r\n\x1a\n", png.Decode, png.DecodeConfig)
}

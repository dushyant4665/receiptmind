package services

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

type OCRService struct {
	timeout time.Duration
}

func NewOCRService() *OCRService {
	return &OCRService{timeout: 3 * time.Second}
}

func (s *OCRService) ExtractText(ctx context.Context, imageData []byte) (string, error) {
	if _, err := exec.LookPath("tesseract"); err != nil {
		return "", fmt.Errorf("tesseract not installed: %w", err)
	}

	tmp, err := os.CreateTemp("", "receiptmind-ocr-*.png")
	if err != nil {
		return "", fmt.Errorf("create ocr temp image: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := tmp.Write(imageData); err != nil {
		tmp.Close()
		return "", fmt.Errorf("write ocr temp image: %w", err)
	}
	tmp.Close()

	cmdCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "tesseract", tmpPath, "stdout", "-l", "eng", "--psm", "6")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("tesseract failed: %w: %s", err, stderr.String())
	}

	text := cleanOCRText(string(out))
	if text == "" {
		return "", fmt.Errorf("tesseract returned empty text")
	}

	log.Info().Int("chars", len(text)).Msg("OCR extraction complete")
	return text, nil
}

func cleanOCRText(text string) string {
	text = strings.ReplaceAll(text, "\x00", " ")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")

	spaceRE := regexp.MustCompile(`[ \t]+`)
	blankRE := regexp.MustCompile(`\n{3,}`)

	lines := strings.Split(text, "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(spaceRE.ReplaceAllString(line, " "))
		if line != "" {
			cleaned = append(cleaned, line)
		}
	}

	return strings.TrimSpace(blankRE.ReplaceAllString(strings.Join(cleaned, "\n"), "\n\n"))
}

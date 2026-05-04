package services

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"time"

	"github.com/rs/zerolog/log"
)

type PDFService struct {
	timeout time.Duration
}

func NewPDFService() *PDFService {
	return &PDFService{timeout: 4 * time.Second}
}

func (s *PDFService) ConvertPDFToImages(ctx context.Context, pdfData []byte) ([][]byte, error) {
	if len(pdfData) < 4 || string(pdfData[:4]) != "%PDF" {
		return nil, fmt.Errorf("invalid pdf header")
	}

	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return nil, fmt.Errorf("pdftoppm not installed: %w", err)
	}

	tmpDir, err := os.MkdirTemp("", "receiptmind-pdf-*")
	if err != nil {
		return nil, fmt.Errorf("create pdf temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	pdfPath := filepath.Join(tmpDir, "input.pdf")
	if err := os.WriteFile(pdfPath, pdfData, 0o600); err != nil {
		return nil, fmt.Errorf("write temp pdf: %w", err)
	}

	outputPrefix := filepath.Join(tmpDir, "page")
	cmdCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "pdftoppm", "-png", "-r", "180", "-f", "1", "-l", "5", pdfPath, outputPrefix)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pdftoppm failed: %w: %s", err, stderr.String())
	}

	matches, err := filepath.Glob(outputPrefix + "-*.png")
	if err != nil {
		return nil, fmt.Errorf("find converted pdf pages: %w", err)
	}
	sort.Strings(matches)
	if len(matches) == 0 {
		return nil, fmt.Errorf("pdftoppm produced no pages")
	}

	images := make([][]byte, 0, len(matches))
	for _, match := range matches {
		data, err := os.ReadFile(match)
		if err != nil {
			log.Warn().Err(err).Str("page", match).Msg("Failed to read converted PDF page")
			continue
		}
		images = append(images, data)
	}

	if len(images) == 0 {
		return nil, fmt.Errorf("no readable converted pdf pages")
	}

	log.Info().Int("pages", len(images)).Msg("PDF converted to images")
	return images, nil
}

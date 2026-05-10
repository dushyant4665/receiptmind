package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type StorageService struct {
	config *config.Config
	client *http.Client
}

func NewStorageService(cfg *config.Config) *StorageService {
	return &StorageService{
		config: cfg,
		client: &http.Client{},
	}
}

func (s *StorageService) UploadFile(fileData []byte, filename string, organizationID string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	safeName := uuid.New().String() + ext
	now := time.Now().UTC()
	filePath := fmt.Sprintf("%s/%04d/%02d/%s", organizationID, now.Year(), now.Month(), safeName)

	// Fallback to local storage if Supabase not configured
	if s.config.SupabaseURL == "" || s.config.SupabaseURL == "http://localhost:54321" {
		localPath := filepath.Join("uploads", filepath.FromSlash(filePath))
		dir := filepath.Dir(localPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create upload directory: %w", err)
		}
		if err := os.WriteFile(localPath, fileData, 0644); err != nil {
			return "", fmt.Errorf("failed to write file: %w", err)
		}
		log.Info().Str("path", filePath).Msg("File uploaded to local storage")
		return filePath, nil
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.config.SupabaseURL, s.config.SupabaseBucket, filePath)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", safeName)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, bytes.NewReader(fileData)); err != nil {
		return "", fmt.Errorf("failed to copy file data: %w", err)
	}

	writer.Close()

	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.config.SupabaseKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Supabase upload request failed, falling back to local")
		localPath := filepath.Join("uploads", filepath.FromSlash(filePath))
		dir := filepath.Dir(localPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create upload directory: %w", err)
		}
		if err := os.WriteFile(localPath, fileData, 0644); err != nil {
			return "", fmt.Errorf("failed to write file locally: %w", err)
		}
		log.Info().Str("path", filePath).Msg("File uploaded to local storage (fallback)")
		return filePath, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Error().Int("status", resp.StatusCode).Str("body", string(body)).Msg("Storage upload failed, falling back to local")
		localPath := filepath.Join("uploads", filepath.FromSlash(filePath))
		dir := filepath.Dir(localPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create upload directory: %w", err)
		}
		if err := os.WriteFile(localPath, fileData, 0644); err != nil {
			return "", fmt.Errorf("failed to write file locally: %w", err)
		}
		log.Info().Str("path", filePath).Msg("File uploaded to local storage (fallback)")
		return filePath, nil
	}

	log.Info().Str("path", filePath).Msg("File uploaded to storage")
	return filePath, nil
}

func (s *StorageService) GetSignedURL(filePath string) (string, error) {
	// Try local file first
	localPath := fmt.Sprintf("uploads/%s", filePath)
	if _, err := os.Stat(localPath); err == nil {
		return fmt.Sprintf("/uploads/%s", filePath), nil
	}

	// Fallback to Supabase signed URL
	if s.config.SupabaseURL == "" || s.config.SupabaseURL == "http://localhost:54321" {
		return "", fmt.Errorf("file not found locally and Supabase not configured: %s", filePath)
	}

	url := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", s.config.SupabaseURL, s.config.SupabaseBucket, filePath)

	body := `{"expiresIn":3600}`

	req, err := http.NewRequest("POST", url, strings.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create signed url request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.config.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get signed url: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("signed url request failed with status %d", resp.StatusCode)
	}

	var result struct {
		SignedURL string `json:"signedUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode signed url response: %w", err)
	}

	if strings.HasPrefix(result.SignedURL, "http") {
		return result.SignedURL, nil
	}
	return strings.TrimRight(s.config.SupabaseURL, "/") + result.SignedURL, nil
}

func (s *StorageService) DownloadFile(ctx context.Context, filePath string) ([]byte, error) {
	// Try local file first
	localPath := fmt.Sprintf("uploads/%s", filePath)
	if data, err := os.ReadFile(localPath); err == nil {
		log.Info().Str("path", filePath).Msg("File downloaded from local storage")
		return data, nil
	}

	// Fallback to Supabase
	if s.config.SupabaseURL == "" {
		return nil, fmt.Errorf("file not found locally and Supabase not configured: %s", filePath)
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.config.SupabaseURL, s.config.SupabaseBucket, filePath)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create download request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.config.SupabaseKey)

	resp, err := s.client.Do(req)
	if err != nil {
		// Supabase unreachable, try local as last resort
		log.Warn().Err(err).Msg("Supabase download failed")
		return nil, fmt.Errorf("failed to download file (Supabase unreachable and not found locally): %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read download response: %w", err)
	}

	return data, nil
}

func (s *StorageService) DeleteFile(ctx context.Context, filePath string) error {
	localPath := filepath.Join("uploads", filepath.FromSlash(filePath))
	if err := os.Remove(localPath); err == nil || os.IsNotExist(err) {
		if s.config.SupabaseURL == "" || s.config.SupabaseURL == "http://localhost:54321" {
			return nil
		}
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.config.SupabaseURL, s.config.SupabaseBucket, filePath)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.config.SupabaseKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != 404 {
		return fmt.Errorf("delete failed with status %d", resp.StatusCode)
	}

	log.Info().Str("path", filePath).Msg("File deleted from storage")
	return nil
}

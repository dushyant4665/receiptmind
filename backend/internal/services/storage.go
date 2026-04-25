package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
)

type StorageService struct {
	baseURL        string
	serviceRoleKey string
	bucket         string
	httpClient     *http.Client
}

type supabaseStorageObject struct {
	Key string `json:"Key"`
}

func NewStorageService(_ context.Context) (*StorageService, error) {
	baseURL := strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	bucket := os.Getenv("SUPABASE_STORAGE_BUCKET")
	if bucket == "" {
		bucket = "receipt-files"
	}

	if baseURL == "" || serviceRoleKey == "" {
		return nil, fmt.Errorf("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
	}

	if _, err := url.Parse(baseURL); err != nil {
		return nil, fmt.Errorf("invalid SUPABASE_URL: %w", err)
	}

	return &StorageService{
		baseURL:        baseURL,
		serviceRoleKey: serviceRoleKey,
		bucket:         bucket,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (s *StorageService) UploadReceiptFile(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (string, int64, string, error) {
	f, err := fileHeader.Open()
	if err != nil {
		return "", 0, "", err
	}
	defer f.Close()

	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, f); err != nil {
		return "", 0, "", err
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	objectPath := path.Join("receipts", userID, time.Now().Format("2006/01/02"), uuid.NewString()+"_"+sanitizeFilename(fileHeader.Filename))
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucket, objectPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(buf.Bytes()))
	if err != nil {
		return "", 0, "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("x-upsert", "true")
	req.Header.Set("Content-Type", contentType)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", 0, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", 0, "", fmt.Errorf("supabase storage upload failed: %s", strings.TrimSpace(string(body)))
	}

	publicReference := fmt.Sprintf("supabase://%s/%s", s.bucket, objectPath)
	return publicReference, fileHeader.Size, contentType, nil
}

func (s *StorageService) CreateSignedURL(ctx context.Context, objectPath string, expiresInSeconds int) (string, error) {
	if expiresInSeconds <= 0 {
		expiresInSeconds = 3600
	}

	cleanPath := strings.TrimPrefix(objectPath, fmt.Sprintf("supabase://%s/", s.bucket))
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", s.baseURL, s.bucket, cleanPath)
	payload, _ := json.Marshal(map[string]int{"expiresIn": expiresInSeconds})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create signed url: %s", strings.TrimSpace(string(body)))
	}

	var result struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return s.baseURL + "/storage/v1" + result.SignedURL, nil
}

func sanitizeFilename(name string) string {
	replacer := strings.NewReplacer("\\", "_", "/", "_", " ", "_")
	return replacer.Replace(name)
}

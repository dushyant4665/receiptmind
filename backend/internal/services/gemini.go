package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/receiptmind/backend/internal/models"
)

type GeminiService struct {
	apiKey string
}

func NewGeminiService() *GeminiService {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		return nil
	}
	return &GeminiService{apiKey: apiKey}
}

func (g *GeminiService) ExtractReceiptData(ctx context.Context, fileData []byte, mimeType string) (*models.ReceiptExtractionResult, error) {
	if g == nil || g.apiKey == "" {
		return nil, fmt.Errorf("gemini client not configured")
	}

	// Base64 encode the image
	base64Data := base64.StdEncoding.EncodeToString(fileData)

	prompt := `Extract the following fields from this receipt/invoice image and return ONLY a JSON object.

Fields to extract:
- vendor_name: The name of the store or vendor
- amount: The total amount paid (number only, no currency symbol)
- currency: USD, EUR, GBP, or INR
- date: The date on the receipt (YYYY-MM-DD format)
- category: One of: Software, Travel, Office, Food, Equipment, Marketing, Other
- description: Brief description (5 words max)
- confidence: Confidence score 0.0 to 1.0

Return format: {"vendor_name": "string", "amount": number, "currency": "string", "date": "string", "category": "string", "description": "string", "confidence": number}

If a field is not found, use null for strings and 0 for numbers.`

	// Build Gemini request
	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{
						"text": prompt,
					},
					{
						"inline_data": map[string]string{
							"mime_type": mimeType,
							"data":      base64Data,
						},
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.2,
			"maxOutputTokens": 500,
			"responseMimeType": "application/json",
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call Gemini API
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", g.apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Gemini API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("Gemini API error: %s, body: %s", resp.Status, string(body))
		return nil, fmt.Errorf("gemini API error: %s", resp.Status)
	}

	// Parse response
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(body, &geminiResp); err != nil {
		log.Printf("Failed to parse Gemini response: %v, raw: %s", err, string(body))
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("no response from Gemini")
	}

	content := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)

	// Parse the JSON from Gemini
	var raw struct {
		VendorName  *string  `json:"vendor_name"`
		Amount      *float64 `json:"amount"`
		Currency    *string  `json:"currency"`
		Date        *string  `json:"date"`
		Category    *string  `json:"category"`
		Description *string  `json:"description"`
		Confidence  *float64 `json:"confidence"`
	}

	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		log.Printf("Failed to parse extracted data: %v, raw: %s", err, content)
		return &models.ReceiptExtractionResult{
			VendorName:  "Unknown",
			Amount:      0,
			Currency:    "USD",
			Date:        time.Now(),
			Category:    "Other",
			Description: "Receipt processed",
			Confidence:  0.5,
		}, nil
	}

	res := &models.ReceiptExtractionResult{
		VendorName:  "",
		Amount:      0,
		Currency:    "USD",
		Date:        time.Now(),
		Category:    "Other",
		Description: "",
		Confidence:  0.85,
	}

	if raw.VendorName != nil {
		res.VendorName = *raw.VendorName
	}
	if raw.Amount != nil {
		res.Amount = *raw.Amount
	}
	if raw.Currency != nil && *raw.Currency != "" {
		res.Currency = *raw.Currency
	}
	if raw.Category != nil && *raw.Category != "" {
		res.Category = *raw.Category
	}
	if raw.Description != nil {
		res.Description = *raw.Description
	}
	if raw.Date != nil && *raw.Date != "" {
		if parsed, err := time.Parse("2006-01-02", *raw.Date); err == nil {
			res.Date = parsed
		}
	}
	if raw.Confidence != nil {
		res.Confidence = *raw.Confidence
	}

	return res, nil
}

package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type ExtractionResult struct {
	VendorName  string  `json:"vendor_name"`
	Amount      float64 `json:"amount"`
	ReceiptDate string  `json:"receipt_date"`
	Category    string  `json:"category"`
	Confidence  float64 `json:"confidence"`
}

type AIService struct {
	config *config.Config
	client *http.Client
}

func NewAIService(cfg *config.Config) *AIService {
	return &AIService{
		config: cfg,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func (a *AIService) ExtractReceiptData(ctx context.Context, fileBytes []byte) (*ExtractionResult, error) {
	b64 := base64.StdEncoding.EncodeToString(fileBytes)

	// Prefer Gemini if key is provided (Free tier friendly)
	if a.config.GeminiKey != "" {
		log.Info().Msg("Using Gemini 1.5 Flash for extraction")
		return a.callGemini(ctx, b64)
	}

	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		result, err := a.callOpenAI(ctx, b64)
		if err == nil {
			return result, nil
		}
		lastErr = err
		log.Warn().Err(err).Int("attempt", attempt).Msg("OpenAI call failed, retrying")
	}

	return nil, fmt.Errorf("extraction failed: %w", lastErr)
}

func (a *AIService) callGemini(ctx context.Context, base64Image string) (*ExtractionResult, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=%s", a.config.GeminiKey)

	prompt := `Extract the following fields from the receipt image and return ONLY valid JSON:
{
  "vendor_name": "string",
  "amount": 0.00,
  "receipt_date": "YYYY-MM-DD",
  "category": "string",
  "confidence": 0.00
}
Return only the JSON block, no markdown formatting.`

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
					{
						"inline_data": map[string]string{
							"mime_type": "image/jpeg",
							"data":      base64Image,
						},
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      0.1,
			"topP":             0.95,
			"topK":             64,
			"maxOutputTokens":  1024,
			"responseMimeType": "application/json",
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("gemini error %d: %s", resp.StatusCode, string(body))
	}

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
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	var result ExtractionResult
	contentText := geminiResp.Candidates[0].Content.Parts[0].Text
	if err := json.Unmarshal([]byte(contentText), &result); err != nil {
		return nil, fmt.Errorf("failed to parse gemini output: %w", err)
	}

	return &result, nil
}

func (a *AIService) callOpenAI(ctx context.Context, base64Image string) (*ExtractionResult, error) {
	url := "https://api.openai.com/v1/chat/completions"

	systemPrompt := `You are a receipt data extraction assistant. Extract the following fields from the receipt image and return ONLY valid JSON:
{
  "vendor_name": "string - the vendor/store name",
  "amount": 0.00 - the total amount as a number,
  "receipt_date": "YYYY-MM-DD" - the date on the receipt,
  "category": "string - one of: Food, Travel, Office, Utilities, Entertainment, Healthcare, General",
  "confidence": 0.00 - your confidence level from 0.0 to 1.0
}
If a field cannot be determined, use null for strings, 0 for amount, and 0.0 for confidence.`

	userContent := []map[string]interface{}{
		{
			"type": "text",
			"text": "Extract the receipt data from this image and return only the JSON.",
		},
		{
			"type": "image_url",
			"image_url": map[string]string{
				"url": fmt.Sprintf("data:image/jpeg;base64,%s", base64Image),
			},
		},
	}

	reqBody := map[string]interface{}{
		"model": a.config.OpenAIModel,
		"messages": []map[string]interface{}{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userContent},
		},
		"max_tokens":  500,
		"temperature": 0.1,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.config.OpenAIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("openai returned status %d: %s", resp.StatusCode, string(body))
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode chat response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in openai response")
	}

	var result ExtractionResult
	content := chatResp.Choices[0].Message.Content
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse extraction result: %w (content: %s)", err, content)
	}

	log.Info().
		Str("vendor", result.VendorName).
		Float64("amount", result.Amount).
		Float64("confidence", result.Confidence).
		Msg("AI extraction complete")

	return &result, nil
}

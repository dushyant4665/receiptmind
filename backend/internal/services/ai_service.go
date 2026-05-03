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
	// Try latest Gemini 2.0 Flash first, then 1.5 Pro as fallback
	models := []string{"gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"}
	var lastErr error

	for _, model := range models {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, a.config.GeminiKey)
		log.Info().Str("model", model).Msg("Attempting Gemini extraction")

		prompt := `Extract receipt data. Return ONLY a valid JSON object. 
Fields: vendor_name (string), amount (number), receipt_date (YYYY-MM-DD), category (string), confidence (number 0-1).
Do not include markdown blocks or any other text.`

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
				"responseMimeType": "application/json",
			},
		}

		jsonBody, _ := json.Marshal(reqBody)
		req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		resp, err := a.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 {
			lastErr = fmt.Errorf("gemini %s error %d: %s", model, resp.StatusCode, string(body))
			continue
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
			lastErr = err
			continue
		}

		if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
			lastErr = fmt.Errorf("empty response from %s", model)
			continue
		}

		contentText := geminiResp.Candidates[0].Content.Parts[0].Text
		var result ExtractionResult
		if err := json.Unmarshal([]byte(contentText), &result); err != nil {
			lastErr = err
			continue
		}

		log.Info().Str("model", model).Msg("Gemini extraction successful")
		return &result, nil
	}

	return nil, fmt.Errorf("all gemini models failed: %w", lastErr)
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

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/receiptmind/backend/internal/models"
	"github.com/sashabaranov/go-openai"
)

type OpenAIService struct {
	client *openai.Client
}

func NewOpenAIService() *OpenAIService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	client := openai.NewClient(apiKey)
	return &OpenAIService{client: client}
}

func (o *OpenAIService) ExtractReceiptData(ctx context.Context, imageURL string) (*models.ReceiptExtractionResult, error) {
	prompt := `You are a receipt/invoice data extraction assistant. Extract the following fields from this receipt/invoice image and return ONLY a JSON object.

Fields to extract:
- vendor_name: The name of the store or vendor
- amount: The total amount paid (number only, no currency symbol)
- currency: USD, EUR, GBP, or INR
- date: The date on the receipt (YYYY-MM-DD format)
- category: One of: Software, Travel, Office, Food, Equipment, Marketing, Other
- description: Brief description (5 words max)

Return format: {"vendor_name": "string", "amount": number, "currency": "string", "date": "string", "category": "string", "description": "string"}

If a field is not found, use null.`

	resp, err := o.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: "gpt-4o",
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: prompt,
				},
				{
					Role: openai.ChatMessageRoleUser,
					MultiContent: []openai.ChatMessagePart{
						{
							Type: openai.ChatMessagePartTypeImageURL,
							ImageURL: &openai.ChatMessageImageURL{
								URL: imageURL,
							},
						},
					},
				},
			},
			MaxTokens:   500,
			Temperature: 0.2,
		},
	)
	if err != nil {
		log.Printf("OpenAI API error: %v", err)
		return nil, fmt.Errorf("failed to process receipt: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	content := strings.TrimSpace(resp.Choices[0].Message.Content)

	var raw struct {
		VendorName  *string  `json:"vendor_name"`
		Amount      *float64 `json:"amount"`
		Currency    *string  `json:"currency"`
		Date        *string  `json:"date"`
		Category    *string  `json:"category"`
		Description *string  `json:"description"`
	}

	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		log.Printf("Failed to parse OpenAI response: %v, raw: %s", err, content)
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
		Confidence:  0.95,
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

	return res, nil
}

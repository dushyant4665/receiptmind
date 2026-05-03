package models

import (
	"time"
)

type Receipt struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	UserID         string     `json:"user_id"`
	FilePath       string     `json:"file_path"`
	FileURL        string     `json:"file_url"`
	Status         string     `json:"status"`
	RawVendorName  *string    `json:"raw_vendor_name"`
	RawAmount      *float64   `json:"raw_amount"`
	RawDate        *time.Time `json:"raw_date"`
	RawCategory    *string    `json:"raw_category"`
	RawConfidence  *float64   `json:"raw_confidence"`
	VendorName     *string    `json:"vendor_name"`
	Amount         *float64   `json:"amount"`
	ReceiptDate    *time.Time `json:"receipt_date"`
	Category       *string    `json:"category"`
	Confidence     *float64   `json:"confidence"`
	CreatedAt      time.Time  `json:"created_at"`
}

type ReceiptUploadResponse struct {
	ReceiptID string `json:"receipt_id"`
	Status    string `json:"status"`
}

type ReceiptListResponse struct {
	Receipts []Receipt `json:"receipts"`
	Total    int       `json:"total"`
	Limit    int       `json:"limit"`
	Offset   int       `json:"offset"`
}

type ReceiptEditRequest struct {
	VendorName  *string  `json:"vendor_name"`
	Amount      *float64 `json:"amount"`
	ReceiptDate *string  `json:"receipt_date"`
	Category    *string  `json:"category"`
}

type Exception struct {
	ID             string    `json:"id"`
	ReceiptID      string    `json:"receipt_id"`
	OrganizationID string    `json:"organization_id"`
	Type           string    `json:"type"`
	Field          string    `json:"field"`
	Message        string    `json:"message"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type Rule struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	ConditionType  string    `json:"condition_type"`
	ConditionValue string    `json:"condition_value"`
	ActionType     string    `json:"action_type"`
	ActionValue    string    `json:"action_value"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateRuleRequest struct {
	ConditionType  string `json:"condition_type"`
	ConditionValue string `json:"condition_value"`
	ActionType     string `json:"action_type"`
	ActionValue    string `json:"action_value"`
}

type ResolveExceptionRequest struct {
	VendorName  *string  `json:"vendor_name"`
	Amount      *float64 `json:"amount"`
	ReceiptDate *string  `json:"receipt_date"`
	Category    *string  `json:"category"`
}

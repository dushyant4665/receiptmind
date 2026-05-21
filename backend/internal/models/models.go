package models

import (
	"encoding/json"
	"time"
)

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type User struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Name            string     `json:"name"`
	PasswordHash    string     `json:"-"`
	OrganizationID  string     `json:"organization_id"`
	Status          string     `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

type Session struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AuthResponse struct {
	AccessToken    string       `json:"access_token"`
	RefreshToken   string       `json:"refresh_token"`
	User           UserResponse `json:"user"`
	OrganizationID string       `json:"organization_id"`
}

type UserResponse struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	OrganizationID string    `json:"organization_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type Receipt struct {
	ID                string          `json:"id"`
	OrganizationID    string          `json:"organization_id"`
	UserID            string          `json:"user_id"`
	FilePath          string          `json:"file_path"`
	FileURL           string          `json:"file_url"`
	Status            string          `json:"status"`
	RawVendorName     *string         `json:"raw_vendor_name,omitempty"`
	RawAmount         *float64        `json:"raw_amount,omitempty"`
	RawDate           *time.Time      `json:"raw_date,omitempty"`
	RawCategory       *string         `json:"raw_category,omitempty"`
	RawConfidence     *float64        `json:"raw_confidence,omitempty"`
	VendorName        *string         `json:"vendor_name,omitempty"`
	Amount            *float64        `json:"amount,omitempty"`
	ReceiptDate       *time.Time      `json:"receipt_date,omitempty"`
	Category          *string         `json:"category,omitempty"`
	Confidence        *float64        `json:"confidence,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	RawExtraction     json.RawMessage `json:"raw_extraction,omitempty"`
	UserCorrections   json.RawMessage `json:"user_corrections,omitempty"`
	AIOutput          json.RawMessage `json:"ai_output,omitempty"`
	NeedsReview       bool            `json:"needs_review"`
	ProcessingState   string          `json:"processing_state,omitempty"`
	ValidationConfidence float64      `json:"validation_confidence,omitempty"`
	FinalConfidence   float64         `json:"final_confidence,omitempty"`
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

type ResolveExceptionRequest struct {
	VendorName  *string  `json:"vendor_name"`
	Amount      *float64 `json:"amount"`
	ReceiptDate *string  `json:"receipt_date"`
	Category    *string  `json:"category"`
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

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:             u.ID,
		Email:          u.Email,
		Name:           u.Name,
		OrganizationID: u.OrganizationID,
		CreatedAt:      u.CreatedAt,
	}
}



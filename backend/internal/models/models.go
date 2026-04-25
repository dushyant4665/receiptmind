package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Name         string    `json:"name" db:"name"`
	Role         string    `json:"role" db:"role"`
	AvatarURL    string    `json:"avatar_url,omitempty" db:"avatar_url"`
	CompanyName  string    `json:"company_name,omitempty" db:"company_name"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type Session struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	TokenHash string    `json:"-" db:"token_hash"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	IPAddress string    `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent string    `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Receipt struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	Filename    string     `json:"filename" db:"filename"`
	FileURL     string     `json:"file_url" db:"file_url"`
	FileSize    int64      `json:"file_size" db:"file_size"`
	MimeType    string     `json:"mime_type" db:"mime_type"`
	Status      string     `json:"status" db:"status"`
	VendorName  string     `json:"vendor_name,omitempty" db:"vendor_name"`
	Amount      *float64   `json:"amount,omitempty" db:"amount"`
	Currency    string     `json:"currency,omitempty" db:"currency"`
	Date        *time.Time `json:"date,omitempty" db:"date"`
	Category    string     `json:"category,omitempty" db:"category"`
	Description string     `json:"description,omitempty" db:"description"`
	RawOCRText  string     `json:"-" db:"raw_ocr_text"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	ProcessedAt *time.Time `json:"processed_at,omitempty" db:"processed_at"`
}

type Expense struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	ReceiptID   *uuid.UUID `json:"receipt_id,omitempty" db:"receipt_id"`
	VendorName  string     `json:"vendor_name" db:"vendor_name"`
	Amount      float64    `json:"amount" db:"amount"`
	Currency    string     `json:"currency" db:"currency"`
	Date        time.Time  `json:"date" db:"date"`
	Category    string     `json:"category" db:"category"`
	Description string     `json:"description,omitempty" db:"description"`
	Status      string     `json:"status" db:"status"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

type APIKey struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	UserID     uuid.UUID  `json:"user_id" db:"user_id"`
	KeyHash    string     `json:"-" db:"key_hash"`
	Name       string     `json:"name" db:"name"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

type CategoryRule struct {
	ID                          uuid.UUID  `json:"id" db:"id"`
	UserID                      uuid.UUID  `json:"user_id" db:"user_id"`
	Name                        string     `json:"name" db:"name"`
	Priority                    int        `json:"priority" db:"priority"`
	ConditionVendor             string     `json:"condition_vendor,omitempty" db:"condition_vendor"`
	ConditionAmountMin          *float64   `json:"condition_amount_min,omitempty" db:"condition_amount_min"`
	ConditionAmountMax          *float64   `json:"condition_amount_max,omitempty" db:"condition_amount_max"`
	ConditionDescriptionContains string    `json:"condition_description_contains,omitempty" db:"condition_description_contains"`
	ActionCategory              string     `json:"action_category" db:"action_category"`
	ActionSubcategory           string     `json:"action_subcategory,omitempty" db:"action_subcategory"`
	ActionTaxCode               string     `json:"action_tax_code,omitempty" db:"action_tax_code"`
	ActionIsBillable            *bool      `json:"action_is_billable,omitempty" db:"action_is_billable"`
	ActionIsReimbursable        *bool      `json:"action_is_reimbursable,omitempty" db:"action_is_reimbursable"`
	ActionNotes                 string     `json:"action_notes,omitempty" db:"action_notes"`
	IsActive                    bool       `json:"is_active" db:"is_active"`
	TimesApplied                int        `json:"times_applied" db:"times_applied"`
	CreatedBy                   *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt                   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                   time.Time  `json:"updated_at" db:"updated_at"`
}

type Exception struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	UserID         uuid.UUID  `json:"user_id" db:"user_id"`
	ReceiptID      *uuid.UUID `json:"receipt_id,omitempty" db:"receipt_id"`
	Type           string     `json:"type" db:"type"`
	Severity       string     `json:"severity" db:"severity"`
	Description    string     `json:"description" db:"description"`
	SuggestedAction string    `json:"suggested_action,omitempty" db:"suggested_action"`
	Status         string     `json:"status" db:"status"`
	ResolvedBy     *uuid.UUID `json:"resolved_by,omitempty" db:"resolved_by"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	ResolutionNotes string    `json:"resolution_notes,omitempty" db:"resolution_notes"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type AuditLog struct {
	ID         uuid.UUID       `json:"id" db:"id"`
	UserID     *uuid.UUID      `json:"user_id,omitempty" db:"user_id"`
	Action     string          `json:"action" db:"action"`
	ResourceID string          `json:"resource_id,omitempty" db:"resource_id"`
	IPAddress  string          `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent  string          `json:"user_agent,omitempty" db:"user_agent"`
	Metadata   json.RawMessage `json:"metadata,omitempty" db:"metadata"`
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
}

type DashboardStats struct {
	TotalSpent     float64 `json:"total_spent"`
	ReceiptCount   int     `json:"receipt_count"`
	ExpenseCount   int     `json:"expense_count"`
	MonthlyChange  float64 `json:"monthly_change"`
	AccuracyRate   float64 `json:"accuracy_rate"`
	TimeSavedHours float64 `json:"time_saved_hours"`
}

type ReceiptExtractionResult struct {
	VendorName  string    `json:"vendor_name"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Date        time.Time `json:"date"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Confidence  float64   `json:"confidence"`
}

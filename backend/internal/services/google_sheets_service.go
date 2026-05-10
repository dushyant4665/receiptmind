package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
)

type GoogleSheetsService struct {
	enabled       bool
	spreadsheetID string
	accessToken   string
	client        *http.Client
	db            *database.Database
}

type SheetRow struct {
	OrganizationID string
	Date           string
	Vendor         string
	Amount         float64
	Category       string
	Status         string
	Notes          string
}

func NewGoogleSheetsService(cfg *config.Config, db ...*database.Database) *GoogleSheetsService {
	var databaseRef *database.Database
	if len(db) > 0 {
		databaseRef = db[0]
	}
	return &GoogleSheetsService{
		enabled:       cfg.GoogleSheetsEnabled && cfg.GoogleSheetsSpreadsheetID != "" && cfg.GoogleSheetsAccessToken != "",
		spreadsheetID: cfg.GoogleSheetsSpreadsheetID,
		accessToken:   cfg.GoogleSheetsAccessToken,
		client:        &http.Client{Timeout: 3 * time.Second},
		db:            databaseRef,
	}
}

func (s *GoogleSheetsService) SyncReceipt(ctx context.Context, row SheetRow) error {
	spreadsheetID, accessToken, err := s.credentialsForOrg(ctx, row.OrganizationID)
	if err != nil {
		return err
	}
	if spreadsheetID == "" || accessToken == "" {
		return nil
	}

	sheetName := monthSheetName(row.Date)
	if err := s.ensureSheet(ctx, spreadsheetID, accessToken, sheetName); err != nil {
		return err
	}
	if err := s.appendRows(ctx, spreadsheetID, accessToken, sheetName, []SheetRow{row}); err != nil {
		if s.db != nil && row.OrganizationID != "" {
			_, _ = s.db.Pool.Exec(ctx, "UPDATE google_integrations SET last_error = $1, updated_at = NOW() WHERE organization_id = $2 AND deleted_at IS NULL", err.Error(), row.OrganizationID)
		}
		return err
	}
	if s.db != nil && row.OrganizationID != "" {
		_, _ = s.db.Pool.Exec(ctx, "UPDATE google_integrations SET last_sync_at = NOW(), last_error = NULL, updated_at = NOW() WHERE organization_id = $1 AND deleted_at IS NULL", row.OrganizationID)
	}
	return nil
}

func (s *GoogleSheetsService) credentialsForOrg(ctx context.Context, orgID string) (string, string, error) {
	if s.db != nil && orgID != "" {
		var spreadsheetID, accessToken string
		err := s.db.Pool.QueryRow(ctx,
			`SELECT spreadsheet_id, access_token_encrypted
			 FROM google_integrations
			 WHERE organization_id = $1 AND status = 'connected' AND deleted_at IS NULL
			 LIMIT 1`,
			orgID,
		).Scan(&spreadsheetID, &accessToken)
		if err == nil {
			return spreadsheetID, accessToken, nil
		}
		if err != pgx.ErrNoRows {
			return "", "", err
		}
	}
	if s.enabled {
		return s.spreadsheetID, s.accessToken, nil
	}
	return "", "", nil
}

func (s *GoogleSheetsService) ensureSheet(ctx context.Context, spreadsheetID, accessToken, sheetName string) error {
	body := map[string]interface{}{
		"requests": []map[string]interface{}{
			{
				"addSheet": map[string]interface{}{
					"properties": map[string]interface{}{"title": sheetName},
				},
			},
		},
	}
	respBody, status, err := s.doJSON(ctx, http.MethodPost, fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s:batchUpdate", spreadsheetID), accessToken, body)
	if err != nil {
		return err
	}
	if status >= 200 && status < 300 {
		_ = s.appendHeader(ctx, spreadsheetID, accessToken, sheetName)
		return nil
	}
	if bytes.Contains(respBody, []byte("already exists")) {
		return nil
	}
	return fmt.Errorf("google sheets create sheet failed %d: %s", status, string(respBody))
}

func (s *GoogleSheetsService) appendHeader(ctx context.Context, spreadsheetID, accessToken, sheetName string) error {
	values := [][]interface{}{{"Date", "Vendor", "Amount", "Category", "Status", "Notes"}}
	return s.appendValues(ctx, spreadsheetID, accessToken, sheetName, values)
}

func (s *GoogleSheetsService) appendRows(ctx context.Context, spreadsheetID, accessToken, sheetName string, rows []SheetRow) error {
	values := make([][]interface{}, 0, len(rows))
	for _, row := range rows {
		values = append(values, []interface{}{row.Date, row.Vendor, row.Amount, row.Category, row.Status, row.Notes})
	}
	return s.appendValues(ctx, spreadsheetID, accessToken, sheetName, values)
}

func (s *GoogleSheetsService) appendValues(ctx context.Context, spreadsheetID, accessToken, sheetName string, values [][]interface{}) error {
	escapedRange := url.PathEscape(fmt.Sprintf("%s!A:F", sheetName))
	endpoint := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", spreadsheetID, escapedRange)
	body := map[string]interface{}{"values": values}
	respBody, status, err := s.doJSON(ctx, http.MethodPost, endpoint, accessToken, body)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("google sheets append failed %d: %s", status, string(respBody))
	}
	log.Info().Str("sheet", sheetName).Int("rows", len(values)).Msg("Google Sheets sync complete")
	return nil
}

func (s *GoogleSheetsService) doJSON(ctx context.Context, method, endpoint, accessToken string, body interface{}) ([]byte, int, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	_, _ = buf.ReadFrom(resp.Body)
	return buf.Bytes(), resp.StatusCode, nil
}

func (s *GoogleSheetsService) CreateSpreadsheet(ctx context.Context, accessToken, title string) (string, error) {
	body := map[string]interface{}{
		"properties": map[string]interface{}{"title": title},
	}
	respBody, status, err := s.doJSON(ctx, http.MethodPost, "https://sheets.googleapis.com/v4/spreadsheets", accessToken, body)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("google sheets create spreadsheet failed %d: %s", status, string(respBody))
	}
	var result struct {
		SpreadsheetID string `json:"spreadsheetId"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	return result.SpreadsheetID, nil
}

func GenerateGoogleState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func monthSheetName(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return time.Now().Format("January 2006")
	}
	return t.Format("January 2006")
}

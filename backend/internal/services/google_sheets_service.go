package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type GoogleSheetsService struct {
	enabled       bool
	spreadsheetID string
	accessToken   string
	client        *http.Client
}

type SheetRow struct {
	Date     string
	Vendor   string
	Amount   float64
	Category string
	Status   string
}

func NewGoogleSheetsService(cfg *config.Config) *GoogleSheetsService {
	return &GoogleSheetsService{
		enabled:       cfg.GoogleSheetsEnabled && cfg.GoogleSheetsSpreadsheetID != "" && cfg.GoogleSheetsAccessToken != "",
		spreadsheetID: cfg.GoogleSheetsSpreadsheetID,
		accessToken:   cfg.GoogleSheetsAccessToken,
		client:        &http.Client{Timeout: 3 * time.Second},
	}
}

func (s *GoogleSheetsService) SyncReceipt(ctx context.Context, row SheetRow) error {
	if !s.enabled {
		return nil
	}

	sheetName := monthSheetName(row.Date)
	if err := s.ensureSheet(ctx, sheetName); err != nil {
		return err
	}
	return s.appendRows(ctx, sheetName, []SheetRow{row})
}

func (s *GoogleSheetsService) ensureSheet(ctx context.Context, sheetName string) error {
	body := map[string]interface{}{
		"requests": []map[string]interface{}{
			{
				"addSheet": map[string]interface{}{
					"properties": map[string]interface{}{"title": sheetName},
				},
			},
		},
	}
	respBody, status, err := s.doJSON(ctx, http.MethodPost, fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s:batchUpdate", s.spreadsheetID), body)
	if err != nil {
		return err
	}
	if status >= 200 && status < 300 {
		_ = s.appendHeader(ctx, sheetName)
		return nil
	}
	if bytes.Contains(respBody, []byte("already exists")) {
		return nil
	}
	return fmt.Errorf("google sheets create sheet failed %d: %s", status, string(respBody))
}

func (s *GoogleSheetsService) appendHeader(ctx context.Context, sheetName string) error {
	values := [][]interface{}{{"Date", "Vendor", "Amount", "Category", "Status"}}
	return s.appendValues(ctx, sheetName, values)
}

func (s *GoogleSheetsService) appendRows(ctx context.Context, sheetName string, rows []SheetRow) error {
	values := make([][]interface{}, 0, len(rows))
	for _, row := range rows {
		values = append(values, []interface{}{row.Date, row.Vendor, row.Amount, row.Category, row.Status})
	}
	return s.appendValues(ctx, sheetName, values)
}

func (s *GoogleSheetsService) appendValues(ctx context.Context, sheetName string, values [][]interface{}) error {
	escapedRange := url.PathEscape(fmt.Sprintf("%s!A:E", sheetName))
	endpoint := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", s.spreadsheetID, escapedRange)
	body := map[string]interface{}{"values": values}
	respBody, status, err := s.doJSON(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("google sheets append failed %d: %s", status, string(respBody))
	}
	log.Info().Str("sheet", sheetName).Int("rows", len(values)).Msg("Google Sheets sync complete")
	return nil
}

func (s *GoogleSheetsService) doJSON(ctx context.Context, method, endpoint string, body interface{}) ([]byte, int, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+s.accessToken)
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

func monthSheetName(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return time.Now().Format("January 2006")
	}
	return t.Format("January 2006")
}

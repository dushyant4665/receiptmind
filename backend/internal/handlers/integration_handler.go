package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/services"
)

type IntegrationHandler struct {
	Config        *config.Config
	DB            *database.Database
	Redis         *redis.Client
	SheetsService *services.GoogleSheetsService
}

func NewIntegrationHandler(cfg *config.Config, db *database.Database, redisClient *redis.Client, sheetsSvc *services.GoogleSheetsService) *IntegrationHandler {
	return &IntegrationHandler{Config: cfg, DB: db, Redis: redisClient, SheetsService: sheetsSvc}
}

func (h *IntegrationHandler) Status(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	alias := orgID
	if len(alias) > 8 {
		alias = alias[:8]
	}
	inboxEmail := fmt.Sprintf("inbox+%s@receiptmind.app", alias)
	ctx := context.Background()

	var spreadsheetID, googleStatus, lastError string
	var lastSync *time.Time
	connected := false
	if h.DB != nil {
		err := h.DB.Pool.QueryRow(ctx,
			`SELECT COALESCE(spreadsheet_id, ''), status, last_sync_at, COALESCE(last_error, '')
			 FROM google_integrations
			 WHERE organization_id = $1 AND deleted_at IS NULL
			 LIMIT 1`,
			orgID,
		).Scan(&spreadsheetID, &googleStatus, &lastSync, &lastError)
		if err == nil && googleStatus == "connected" && spreadsheetID != "" {
			connected = true
		}
	}
	envConnected := h.Config.GoogleSheetsEnabled && h.Config.GoogleSheetsSpreadsheetID != "" && h.Config.GoogleSheetsAccessToken != ""

	return c.JSON(SuccessResponse(fiber.Map{
		"email": fiber.Map{
			"enabled":       h.Config.EmailWebhookToken != "",
			"address":       inboxEmail,
			"webhook_route": "/email/webhook",
		},
		"google_sheets": fiber.Map{
			"enabled":            connected || envConnected,
			"connected":          connected,
			"spreadsheet_id":     spreadsheetID,
			"spreadsheet_id_set": spreadsheetID != "" || h.Config.GoogleSheetsSpreadsheetID != "",
			"last_sync_at":       lastSync,
			"last_error":         lastError,
			"oauth_configured":   h.googleOAuthConfigured(),
		},
	}))
}

func (h *IntegrationHandler) GoogleConnect(c *fiber.Ctx) error {
	if !h.googleOAuthConfigured() {
		return SendError(c, fiber.StatusServiceUnavailable, "google oauth is not configured")
	}
	orgID := c.Locals("organization_id").(string)
	userID := c.Locals("user_id").(string)
	state, err := services.GenerateGoogleState()
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to start google connection")
	}
	statePayload, _ := json.Marshal(fiber.Map{"org_id": orgID, "user_id": userID})
	if h.Redis != nil {
		if err := h.Redis.Set(context.Background(), "google_oauth:"+state, statePayload, 10*time.Minute).Err(); err != nil {
			log.Error().Err(err).Msg("Failed to store google oauth state")
			return SendError(c, fiber.StatusInternalServerError, "failed to start google connection")
		}
	}

	authURL, _ := url.Parse("https://accounts.google.com/o/oauth2/v2/auth")
	query := authURL.Query()
	query.Set("client_id", h.Config.GoogleClientID)
	query.Set("redirect_uri", h.googleRedirectURL())
	query.Set("response_type", "code")
	query.Set("scope", "https://www.googleapis.com/auth/spreadsheets")
	query.Set("access_type", "offline")
	query.Set("prompt", "consent")
	query.Set("state", state)
	authURL.RawQuery = query.Encode()

	return c.JSON(SuccessResponse(fiber.Map{"url": authURL.String()}))
}

func (h *IntegrationHandler) GoogleCallback(c *fiber.Ctx) error {
	if !h.googleOAuthConfigured() {
		return SendError(c, fiber.StatusServiceUnavailable, "google oauth is not configured")
	}
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		return SendError(c, fiber.StatusBadRequest, "missing google oauth code or state")
	}
	ctx := context.Background()
	payload, err := h.Redis.Get(ctx, "google_oauth:"+state).Result()
	if err != nil {
		return SendError(c, fiber.StatusBadRequest, "google oauth session expired")
	}
	_ = h.Redis.Del(ctx, "google_oauth:"+state).Err()
	var stateData struct {
		OrgID  string `json:"org_id"`
		UserID string `json:"user_id"`
	}
	if err := json.Unmarshal([]byte(payload), &stateData); err != nil || stateData.OrgID == "" {
		return SendError(c, fiber.StatusBadRequest, "invalid google oauth state")
	}

	token, err := h.exchangeGoogleCode(ctx, code)
	if err != nil {
		log.Error().Err(err).Msg("Google token exchange failed")
		return SendError(c, fiber.StatusBadGateway, "failed to connect google")
	}
	title := "ReceiptMind - " + time.Now().Format("January 2006")
	spreadsheetID, err := h.SheetsService.CreateSpreadsheet(ctx, token.AccessToken, title)
	if err != nil {
		log.Error().Err(err).Msg("Google spreadsheet creation failed")
		return SendError(c, fiber.StatusBadGateway, "failed to create google sheet")
	}
	expiresAt := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
	if token.RefreshToken == "" {
		token.RefreshToken = "not_provided"
	}
	_, err = h.DB.Pool.Exec(ctx,
		`INSERT INTO google_integrations (id, organization_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, spreadsheet_id, spreadsheet_name, status, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected', NOW())
		 ON CONFLICT (organization_id) WHERE deleted_at IS NULL
		 DO UPDATE SET access_token_encrypted = EXCLUDED.access_token_encrypted,
		               refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
		               token_expires_at = EXCLUDED.token_expires_at,
		               spreadsheet_id = EXCLUDED.spreadsheet_id,
		               spreadsheet_name = EXCLUDED.spreadsheet_name,
		               status = 'connected',
		               last_error = NULL,
		               updated_at = NOW()`,
		uuid.NewString(), stateData.OrgID, token.AccessToken, token.RefreshToken, expiresAt, spreadsheetID, title,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save google integration")
		return SendError(c, fiber.StatusInternalServerError, "failed to save google integration")
	}

	return c.Redirect(h.Config.AppURL+"/integrations?google=connected", fiber.StatusFound)
}

func (h *IntegrationHandler) GoogleDisconnect(c *fiber.Ctx) error {
	orgID := c.Locals("organization_id").(string)
	_, err := h.DB.Pool.Exec(context.Background(),
		`UPDATE google_integrations SET status = 'disconnected', deleted_at = NOW(), updated_at = NOW()
		 WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	)
	if err != nil {
		return SendError(c, fiber.StatusInternalServerError, "failed to disconnect google")
	}
	return c.JSON(SuccessResponse(fiber.Map{"disconnected": true}))
}

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

func (h *IntegrationHandler) exchangeGoogleCode(ctx context.Context, code string) (*googleTokenResponse, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", h.Config.GoogleClientID)
	form.Set("client_secret", h.Config.GoogleClientSecret)
	form.Set("redirect_uri", h.googleRedirectURL())
	form.Set("grant_type", "authorization_code")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var token googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 || token.AccessToken == "" {
		if token.ErrorDesc != "" {
			return nil, errors.New(token.ErrorDesc)
		}
		return nil, fmt.Errorf("google token endpoint returned status %d", resp.StatusCode)
	}
	return &token, nil
}

func (h *IntegrationHandler) googleOAuthConfigured() bool {
	return h.Config.GoogleClientID != "" && h.Config.GoogleClientSecret != "" && h.Config.GoogleRedirectURL != ""
}

func (h *IntegrationHandler) googleRedirectURL() string {
	return h.Config.GoogleRedirectURL
}

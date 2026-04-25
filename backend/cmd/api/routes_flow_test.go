package main

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/handlers"
	backendMiddleware "github.com/receiptmind/backend/internal/middleware"
	"github.com/receiptmind/backend/internal/services"
)

func TestReceiptMindRouteFlow(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-super-secret-key-that-is-long-enough")
	t.Setenv("JWT_ACCESS_EXPIRY", "15m")
	t.Setenv("JWT_REFRESH_EXPIRY", "168h")

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	storageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected storage method: %s", r.Method)
		}
		if !strings.Contains(r.URL.Path, "/storage/v1/object/receipt-files/") {
			t.Fatalf("unexpected storage path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"Key":"ok"}`))
	}))
	defer storageServer.Close()

	t.Setenv("SUPABASE_URL", storageServer.URL)
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-for-tests")
	t.Setenv("SUPABASE_STORAGE_BUCKET", "receipt-files")

	storageService, err := services.NewStorageService(context.Background())
	if err != nil {
		t.Fatalf("failed to create storage service: %v", err)
	}

	testDB := &database.PostgresDB{DB: sqlDB}
	authService := services.NewAuthService()

	app := newTestApp(testDB, authService, storageService)

	userID := uuid.New()
	sessionIDRegister := uuid.New()
	sessionIDLogin := uuid.New()
	receiptID := uuid.New()
	expenseID := uuid.New()
	now := time.Date(2026, 4, 24, 10, 0, 0, 0, time.UTC)
	expenseDate := time.Date(2026, 4, 24, 0, 0, 0, 0, time.UTC)

	t.Run("health", func(t *testing.T) {
		resp := doRequest(t, app, http.MethodGet, "/health", "", "")
		assertStatus(t, resp, http.StatusOK)
	})

	t.Run("auth and protected flow", func(t *testing.T) {
		mock.ExpectQuery(regexp.QuoteMeta("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")).
			WithArgs("john@receiptmind.com").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`)).
			WithArgs(anyUUID{}, "john@receiptmind.com", anyString{}, "John Doe", "user").
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, email, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at
		 FROM users WHERE id = $1`)).
			WithArgs(anyUUID{}).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "role", "avatar_url", "company_name", "created_at", "updated_at"}).
				AddRow(userID, "john@receiptmind.com", "John Doe", "user", "", "", now, now))

		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`)).
			WithArgs(anyUUID{}, userID, anyString{}, anyTime{}, "0.0.0.0", "").
			WillReturnResult(sqlmock.NewResult(1, 1))

		registerResp := doJSONRequest(t, app, http.MethodPost, "/api/v1/auth/register", map[string]any{
			"email":    "john@receiptmind.com",
			"password": "Password123!",
			"name":     "John Doe",
		}, "")
		assertStatus(t, registerResp, http.StatusCreated)

		var registerPayload struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			User         struct {
				ID string `json:"id"`
			} `json:"user"`
		}
		decodeJSON(t, registerResp, &registerPayload)
		if registerPayload.AccessToken == "" || registerPayload.RefreshToken == "" {
			t.Fatalf("register response missing tokens")
		}

		hashedPassword, err := authService.HashPassword("Password123!")
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, email, password_hash, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at
		 FROM users WHERE email = $1`)).
			WithArgs("john@receiptmind.com").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "password_hash", "name", "role", "avatar_url", "company_name", "created_at", "updated_at"}).
				AddRow(userID, "john@receiptmind.com", hashedPassword, "John Doe", "user", "", "", now, now))

		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`)).
			WithArgs(anyUUID{}, userID, anyString{}, anyTime{}, "0.0.0.0", "").
			WillReturnResult(sqlmock.NewResult(1, 1))

		loginResp := doJSONRequest(t, app, http.MethodPost, "/api/v1/auth/login", map[string]any{
			"email":    "john@receiptmind.com",
			"password": "Password123!",
		}, "")
		assertStatus(t, loginResp, http.StatusOK)

		var loginPayload struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		decodeJSON(t, loginResp, &loginPayload)
		if loginPayload.AccessToken == "" || loginPayload.RefreshToken == "" {
			t.Fatalf("login response missing tokens")
		}

		loginRefreshHash, err := authService.HashPassword(loginPayload.RefreshToken)
		if err != nil {
			t.Fatalf("failed to hash refresh token: %v", err)
		}

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, token_hash, expires_at FROM sessions WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 50`)).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "token_hash", "expires_at"}).
				AddRow(sessionIDLogin, userID, loginRefreshHash, now.Add(24*time.Hour)))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, email, COALESCE(name, ''), COALESCE(role, 'user'), COALESCE(avatar_url, ''), COALESCE(company_name, ''), created_at, updated_at FROM users WHERE id = $1`)).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "role", "avatar_url", "company_name", "created_at", "updated_at"}).
				AddRow(userID, "john@receiptmind.com", "John Doe", "user", "", "", now, now))

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE sessions SET token_hash = $1, expires_at = $2 WHERE id = $3`)).
			WithArgs(anyString{}, anyTime{}, sessionIDLogin).
			WillReturnResult(sqlmock.NewResult(1, 1))

		refreshResp := doJSONRequest(t, app, http.MethodPost, "/api/v1/auth/refresh", map[string]any{
			"refresh_token": loginPayload.RefreshToken,
		}, "")
		assertStatus(t, refreshResp, http.StatusOK)

		var refreshPayload struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		decodeJSON(t, refreshResp, &refreshPayload)
		if refreshPayload.AccessToken == "" || refreshPayload.RefreshToken == "" {
			t.Fatalf("refresh response missing tokens")
		}

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, email, COALESCE(name,''), COALESCE(role,'user'), COALESCE(avatar_url,''), COALESCE(company_name,''), created_at, updated_at FROM users WHERE id=$1`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "role", "avatar_url", "company_name", "created_at", "updated_at"}).
				AddRow(userID, "john@receiptmind.com", "John Doe", "user", "", "", now, now))

		meResp := doRequest(t, app, http.MethodGet, "/api/v1/users/me", "", bearer(refreshPayload.AccessToken))
		assertStatus(t, meResp, http.StatusOK)

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE users SET name=$1, avatar_url=$2, company_name=$3, updated_at=NOW() WHERE id=$4`)).
			WithArgs("John Updated", "https://avatar.example/john.png", "ReceiptMind", userID.String()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, email, COALESCE(name,''), COALESCE(role,'user'), COALESCE(avatar_url,''), COALESCE(company_name,''), created_at, updated_at FROM users WHERE id=$1`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "role", "avatar_url", "company_name", "created_at", "updated_at"}).
				AddRow(userID, "john@receiptmind.com", "John Updated", "user", "https://avatar.example/john.png", "ReceiptMind", now, now))

		updateMeResp := doJSONRequest(t, app, http.MethodPut, "/api/v1/users/me", map[string]any{
			"name":         "John Updated",
			"avatar_url":   "https://avatar.example/john.png",
			"company_name": "ReceiptMind",
		}, bearer(refreshPayload.AccessToken))
		assertStatus(t, updateMeResp, http.StatusOK)

		newRefreshHash, err := authService.HashPassword(refreshPayload.RefreshToken)
		if err != nil {
			t.Fatalf("failed to hash new refresh token: %v", err)
		}

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, token_hash FROM sessions WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 100`)).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "token_hash"}).
				AddRow(sessionIDRegister, userID, newRefreshHash))

		mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM sessions WHERE id = $1`)).
			WithArgs(sessionIDRegister).
			WillReturnResult(sqlmock.NewResult(1, 1))

		logoutResp := doJSONRequest(t, app, http.MethodPost, "/api/v1/auth/logout", map[string]any{
			"refresh_token": refreshPayload.RefreshToken,
		}, "")
		assertStatus(t, logoutResp, http.StatusOK)

		unauthorizedResp := doRequest(t, app, http.MethodGet, "/api/v1/users/me", "", "")
		assertStatus(t, unauthorizedResp, http.StatusUnauthorized)
	})

	accessToken, err := authService.GenerateAccessToken(userID.String(), "john@receiptmind.com", "user")
	if err != nil {
		t.Fatalf("failed to generate access token for protected routes: %v", err)
	}

	t.Run("expenses routes", func(t *testing.T) {
		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO expenses (id, user_id, receipt_id, vendor_name, amount, currency, expense_date, category, description, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`)).
			WithArgs(anyUUID{}, userID.String(), nil, "Notion", 29.00, "USD", expenseDate, "Software", "Team workspace", "approved").
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE id = $1 AND user_id = $2`)).
			WithArgs(anyUUID{}, userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "receipt_id", "vendor_name", "amount", "currency", "expense_date", "category", "description", "status", "created_at", "updated_at"}).
				AddRow(expenseID, userID, nil, "Notion", 29.00, "USD", expenseDate, "Software", "Team workspace", "approved", now, now))

		createExpenseResp := doJSONRequest(t, app, http.MethodPost, "/api/v1/expenses", map[string]any{
			"vendor_name": "Notion",
			"amount":      29.0,
			"currency":    "USD",
			"date":        "2026-04-24",
			"category":    "Software",
			"description": "Team workspace",
			"status":      "approved",
		}, bearer(accessToken))
		assertStatus(t, createExpenseResp, http.StatusCreated)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE user_id = $1 ORDER BY expense_date DESC LIMIT 100`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "receipt_id", "vendor_name", "amount", "currency", "expense_date", "category", "description", "status", "created_at", "updated_at"}).
				AddRow(expenseID, userID, nil, "Notion", 29.00, "USD", expenseDate, "Software", "Team workspace", "approved", now, now))

		listExpenseResp := doRequest(t, app, http.MethodGet, "/api/v1/expenses", "", bearer(accessToken))
		assertStatus(t, listExpenseResp, http.StatusOK)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE id = $1 AND user_id = $2`)).
			WithArgs(expenseID, userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "receipt_id", "vendor_name", "amount", "currency", "expense_date", "category", "description", "status", "created_at", "updated_at"}).
				AddRow(expenseID, userID, nil, "Notion", 29.00, "USD", expenseDate, "Software", "Team workspace", "approved", now, now))

		getExpenseResp := doRequest(t, app, http.MethodGet, "/api/v1/expenses/"+expenseID.String(), "", bearer(accessToken))
		assertStatus(t, getExpenseResp, http.StatusOK)

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE expenses SET vendor_name=$1, amount=$2, currency=$3, expense_date=$4, category=$5, description=$6, status=$7, updated_at=NOW() WHERE id=$8 AND user_id=$9`)).
			WithArgs("Notion Labs", 39.00, "USD", expenseDate, "Software", "Updated plan", "approved", expenseID, userID.String()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, receipt_id, vendor_name, amount, currency, expense_date, COALESCE(category, ''), COALESCE(description, ''), status, created_at, updated_at
		 FROM expenses WHERE id = $1 AND user_id = $2`)).
			WithArgs(expenseID, userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "receipt_id", "vendor_name", "amount", "currency", "expense_date", "category", "description", "status", "created_at", "updated_at"}).
				AddRow(expenseID, userID, nil, "Notion Labs", 39.00, "USD", expenseDate, "Software", "Updated plan", "approved", now, now))

		updateExpenseResp := doJSONRequest(t, app, http.MethodPut, "/api/v1/expenses/"+expenseID.String(), map[string]any{
			"vendor_name": "Notion Labs",
			"amount":      39.0,
			"currency":    "USD",
			"date":        "2026-04-24",
			"category":    "Software",
			"description": "Updated plan",
			"status":      "approved",
		}, bearer(accessToken))
		assertStatus(t, updateExpenseResp, http.StatusOK)

		mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`)).
			WithArgs(expenseID, userID.String()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		deleteExpenseResp := doRequest(t, app, http.MethodDelete, "/api/v1/expenses/"+expenseID.String(), "", bearer(accessToken))
		assertStatus(t, deleteExpenseResp, http.StatusNoContent)
	})

	t.Run("receipts routes", func(t *testing.T) {
		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO receipts (id, user_id, filename, file_url, file_size, mime_type, status, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,'processing',NOW())`)).
			WithArgs(anyUUID{}, userID.String(), "receipt.txt", anyString{}, anyInt64{}, anyString{}).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE receipts SET status=$1, vendor_name=$2, amount=$3, currency=$4, receipt_date=$5, category=$6, description=$7, processed_at=$8 WHERE id=$9 AND user_id=$10`)).
			WithArgs("pending", nil, nil, nil, nil, nil, nil, anyTime{}, anyUUID{}, userID.String()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
			       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
			 FROM receipts WHERE id=$1 AND user_id=$2`)).
			WithArgs(anyUUID{}, userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "filename", "file_url", "file_size", "mime_type", "status", "vendor_name", "amount", "currency", "receipt_date", "category", "description", "created_at", "processed_at"}).
				AddRow(receiptID, userID, "receipt.txt", "supabase://receipt-files/receipts/test", int64(18), "text/plain", "pending", "", nil, "", nil, "", "", now, now))

		uploadResp := doMultipartRequest(t, app, "/api/v1/receipts/upload", "receipts", "receipt.txt", "sample receipt body", bearer(accessToken))
		assertStatus(t, uploadResp, http.StatusOK)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
		       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
		 FROM receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "filename", "file_url", "file_size", "mime_type", "status", "vendor_name", "amount", "currency", "receipt_date", "category", "description", "created_at", "processed_at"}).
				AddRow(receiptID, userID, "receipt.txt", "supabase://receipt-files/receipts/test", int64(18), "text/plain", "pending", "", nil, "", nil, "", "", now, now))

		listResp := doRequest(t, app, http.MethodGet, "/api/v1/receipts", "", bearer(accessToken))
		assertStatus(t, listResp, http.StatusOK)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, filename, file_url, COALESCE(file_size,0), COALESCE(mime_type,''), status,
		       COALESCE(vendor_name,''), amount, COALESCE(currency,''), receipt_date, COALESCE(category,''), COALESCE(description,''), created_at, processed_at
		 FROM receipts WHERE id=$1 AND user_id=$2`)).
			WithArgs(receiptID, userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "filename", "file_url", "file_size", "mime_type", "status", "vendor_name", "amount", "currency", "receipt_date", "category", "description", "created_at", "processed_at"}).
				AddRow(receiptID, userID, "receipt.txt", "supabase://receipt-files/receipts/test", int64(18), "text/plain", "pending", "", nil, "", nil, "", "", now, now))

		getResp := doRequest(t, app, http.MethodGet, "/api/v1/receipts/"+receiptID.String(), "", bearer(accessToken))
		assertStatus(t, getResp, http.StatusOK)

		mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM receipts WHERE id=$1 AND user_id=$2`)).
			WithArgs(receiptID, userID.String()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		deleteResp := doRequest(t, app, http.MethodDelete, "/api/v1/receipts/"+receiptID.String(), "", bearer(accessToken))
		assertStatus(t, deleteResp, http.StatusNoContent)
	})

	t.Run("dashboard routes", func(t *testing.T) {
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(145.50))
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM receipts WHERE user_id = $1`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM expenses WHERE user_id = $1`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

		statsResp := doRequest(t, app, http.MethodGet, "/api/v1/dashboard/stats", "", bearer(accessToken))
		assertStatus(t, statsResp, http.StatusOK)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id::text, filename, created_at FROM receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`)).
			WithArgs(userID.String()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "filename", "created_at"}).
				AddRow(receiptID.String(), "receipt.txt", now.Format(time.RFC3339)))

		activityResp := doRequest(t, app, http.MethodGet, "/api/v1/dashboard/activity", "", bearer(accessToken))
		assertStatus(t, activityResp, http.StatusOK)
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func newTestApp(db *database.PostgresDB, authService *services.AuthService, storage *services.StorageService) *fiber.App {
	app := fiber.New()
	authHandler := handlers.NewAuthHandler(db, authService, nil)
	userHandler := handlers.NewUserHandler(db)
	expenseHandler := handlers.NewExpenseHandler(db)
	receiptHandler := handlers.NewReceiptHandler(db, storage, nil)
	dashboardHandler := handlers.NewDashboardHandler(db)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api := app.Group("/api/v1")
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	protected := api.Group("/", backendMiddleware.AuthMiddleware(authService))
	protected.Get("/users/me", userHandler.GetMe)
	protected.Put("/users/me", userHandler.UpdateMe)

	receipts := protected.Group("/receipts")
	receipts.Post("/upload", receiptHandler.Upload)
	receipts.Get("/", receiptHandler.List)
	receipts.Get("/:id", receiptHandler.Get)
	receipts.Delete("/:id", receiptHandler.Delete)

	expenses := protected.Group("/expenses")
	expenses.Post("/", expenseHandler.CreateExpense)
	expenses.Get("/", expenseHandler.ListExpenses)
	expenses.Get("/:id", expenseHandler.GetExpense)
	expenses.Put("/:id", expenseHandler.UpdateExpense)
	expenses.Delete("/:id", expenseHandler.DeleteExpense)

	dashboard := protected.Group("/dashboard")
	dashboard.Get("/stats", dashboardHandler.Stats)
	dashboard.Get("/activity", dashboardHandler.Activity)

	return app
}

func doJSONRequest(t *testing.T, app *fiber.App, method, path string, body any, authHeader string) *http.Response {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	return doRequest(t, app, method, path, string(raw), authHeader)
}

func doMultipartRequest(t *testing.T, app *fiber.App, path, fieldName, fileName, content, authHeader string) *http.Response {
	t.Helper()
	buf := new(bytes.Buffer)
	writer := multipart.NewWriter(buf)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := io.Copy(part, strings.NewReader(content)); err != nil {
		t.Fatalf("failed to write multipart body: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	return resp
}

func doRequest(t *testing.T, app *fiber.App, method, path, body, authHeader string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	return resp
}

func assertStatus(t *testing.T, resp *http.Response, expected int) {
	t.Helper()
	if resp.StatusCode != expected {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status: got %d want %d body=%s", resp.StatusCode, expected, string(body))
	}
}

func decodeJSON(t *testing.T, resp *http.Response, target any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
}

func bearer(token string) string {
	return "Bearer " + token
}

type anyUUID struct{}

func (a anyUUID) Match(v driver.Value) bool {
	switch typed := v.(type) {
	case string:
		_, err := uuid.Parse(typed)
		return err == nil
	case []byte:
		_, err := uuid.ParseBytes(typed)
		return err == nil
	default:
		return false
	}
}

type anyString struct{}

func (a anyString) Match(v driver.Value) bool {
	_, ok := v.(string)
	return ok
}

type anyTime struct{}

func (a anyTime) Match(v driver.Value) bool {
	_, ok := v.(time.Time)
	return ok
}

type anyInt64 struct{}

func (a anyInt64) Match(v driver.Value) bool {
	_, ok := v.(int64)
	return ok
}

func TestMain(m *testing.M) {
	code := m.Run()
	os.Exit(code)
}

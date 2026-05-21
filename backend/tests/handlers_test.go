package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"

	"receiptmind-backend/internal/api"
	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/middleware"
	"receiptmind-backend/internal/services"
)

func newTestApp() (*fiber.App, string) {
	cfg := &config.Config{
		Port:        "8080",
		JWTSecret:   "test-jwt-secret-that-is-at-least-32-characters-long",
		Environment: "development",
	}
	jwtSvc := services.NewJWTService(cfg)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(api.ErrorResponse(err.Error()))
		},
	})

	token, _ := jwtSvc.GenerateAccessToken("test-user-id", "test-org-id")

	// Public
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{"status": "ok"}))
	})
	app.Get("/ready", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{"status": "ready"}))
	})
	app.Get("/metrics", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{
			"request_count": 0, "error_count": 0, "error_rate_percent": 0,
			"job_queue_size": 0, "dead_letter_size": 0,
		}))
	})

	// Auth (validation only, no DB)
	app.Post("/auth/register", func(c *fiber.Ctx) error {
		var req struct {
			Email            string `json:"email"`
			Password         string `json:"password"`
			OrganizationName string `json:"organization_name"`
		}
		if err := c.BodyParser(&req); err != nil {
			return api.SendError(c, fiber.StatusBadRequest, "invalid request body")
		}
		if req.Email == "" || req.Password == "" || req.OrganizationName == "" {
			return api.SendError(c, fiber.StatusBadRequest, "email, password, and organization_name are required")
		}
		if len(req.Password) < 6 {
			return api.SendError(c, fiber.StatusBadRequest, "password must be at least 6 characters")
		}
		return c.Status(fiber.StatusCreated).JSON(api.SuccessResponse(fiber.Map{"email": req.Email}))
	})
	app.Post("/auth/login", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&req); err != nil {
			return api.SendError(c, fiber.StatusBadRequest, "invalid request body")
		}
		if req.Email == "" || req.Password == "" {
			return api.SendError(c, fiber.StatusBadRequest, "email and password are required")
		}
		return c.JSON(api.SuccessResponse(fiber.Map{"email": req.Email}))
	})

	// Protected
	protected := app.Group("/", middleware.AuthProtected(jwtSvc))
	protected.Get("/users/me", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{
			"id": c.Locals("user_id"), "organization_id": c.Locals("organization_id"),
		}))
	})
	protected.Get("/dashboard", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{
			"total_receipts": 0, "total_amount": 0, "processed_count": 0,
			"pending_count": 0, "needs_review_count": 0,
		}))
	})
	protected.Get("/receipts/", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{
			"receipts": []interface{}{}, "total": 0, "limit": 20, "offset": 0,
		}))
	})
	protected.Get("/receipts/export/csv", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", "attachment; filename=receipts_test.csv")
		return c.SendString("Vendor,Amount,Category,Date,Status\n")
	})
	protected.Get("/exceptions/", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse([]interface{}{}))
	})
	protected.Post("/exceptions/:id/resolve", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse(fiber.Map{"id": c.Params("id"), "status": "resolved"}))
	})
	protected.Get("/rules/", func(c *fiber.Ctx) error {
		return c.JSON(api.SuccessResponse([]interface{}{}))
	})
	protected.Post("/rules/", func(c *fiber.Ctx) error {
		var req struct {
			ConditionType  string `json:"condition_type"`
			ConditionValue string `json:"condition_value"`
			ActionType     string `json:"action_type"`
			ActionValue    string `json:"action_value"`
		}
		if err := c.BodyParser(&req); err != nil {
			return api.SendError(c, fiber.StatusBadRequest, "invalid request body")
		}
		if req.ConditionType == "" || req.ConditionValue == "" || req.ActionType == "" || req.ActionValue == "" {
			return api.SendError(c, fiber.StatusBadRequest, "all fields are required")
		}
		validCT := map[string]bool{"vendor": true, "category": true, "amount_range": true}
		if !validCT[req.ConditionType] {
			return api.SendError(c, fiber.StatusBadRequest, "invalid condition_type")
		}
		validAT := map[string]bool{"set_category": true, "ignore": true, "recurring": true}
		if !validAT[req.ActionType] {
			return api.SendError(c, fiber.StatusBadRequest, "invalid action_type")
		}
		return c.Status(fiber.StatusCreated).JSON(api.SuccessResponse(req))
	})

	return app, token
}

func doReq(app *fiber.App, method, path string, body interface{}, token string) (*http.Response, map[string]interface{}) {
	var bodyReader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, _ := app.Test(req, -1)
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return resp, result
}

func doMultipartReq(app *fiber.App, path, fieldName, fileName, content, token string) (*http.Response, map[string]interface{}) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, _ := writer.CreateFormFile(fieldName, fileName)
	part.Write([]byte(content))
	writer.Close()
	req := httptest.NewRequest("POST", path, &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, _ := app.Test(req, -1)
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return resp, result
}

func TestHealthEndpoint(t *testing.T) {
	app, _ := newTestApp()
	resp, result := doReq(app, "GET", "/health", nil, "")
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	if result["success"] != true {
		t.Fatalf("Expected success=true, got %v", result["success"])
	}
}

func TestReadyEndpoint(t *testing.T) {
	app, _ := newTestApp()
	resp, result := doReq(app, "GET", "/ready", nil, "")
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	if result["success"] != true {
		t.Fatalf("Expected success=true, got %v", result["success"])
	}
}

func TestMetricsEndpoint(t *testing.T) {
	app, _ := newTestApp()
	resp, result := doReq(app, "GET", "/metrics", nil, "")
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	data := result["data"].(map[string]interface{})
	for _, f := range []string{"request_count", "error_count", "error_rate_percent", "job_queue_size", "dead_letter_size"} {
		if _, ok := data[f]; !ok {
			t.Errorf("Missing field: %s", f)
		}
	}
}

func TestRegisterValidation(t *testing.T) {
	app, _ := newTestApp()
	cases := []struct {
		name string
		body map[string]interface{}
		code int
	}{
		{"valid", map[string]interface{}{"email": "a@b.com", "password": "123456", "organization_name": "X"}, 201},
		{"missing email", map[string]interface{}{"password": "123456", "organization_name": "X"}, 400},
		{"missing password", map[string]interface{}{"email": "a@b.com", "organization_name": "X"}, 400},
		{"missing org", map[string]interface{}{"email": "a@b.com", "password": "123456"}, 400},
		{"short password", map[string]interface{}{"email": "a@b.com", "password": "12", "organization_name": "X"}, 400},
		{"empty body", map[string]interface{}{}, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, _ := doReq(app, "POST", "/auth/register", tc.body, "")
			if resp.StatusCode != tc.code {
				t.Errorf("Expected %d, got %d", tc.code, resp.StatusCode)
			}
		})
	}
}

func TestLoginValidation(t *testing.T) {
	app, _ := newTestApp()
	cases := []struct {
		name string
		body map[string]interface{}
		code int
	}{
		{"valid", map[string]interface{}{"email": "a@b.com", "password": "123456"}, 200},
		{"missing email", map[string]interface{}{"password": "123456"}, 400},
		{"missing password", map[string]interface{}{"email": "a@b.com"}, 400},
		{"empty body", map[string]interface{}{}, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, _ := doReq(app, "POST", "/auth/login", tc.body, "")
			if resp.StatusCode != tc.code {
				t.Errorf("Expected %d, got %d", tc.code, resp.StatusCode)
			}
		})
	}
}

func TestAuthMiddleware(t *testing.T) {
	app, _ := newTestApp()
	_, token := newTestApp()

	// No token → 401
	resp, _ := doReq(app, "GET", "/users/me", nil, "")
	if resp.StatusCode != 401 {
		t.Errorf("Expected 401, got %d", resp.StatusCode)
	}

	// Invalid token → 401
	resp, _ = doReq(app, "GET", "/users/me", nil, "bad-token")
	if resp.StatusCode != 401 {
		t.Errorf("Expected 401, got %d", resp.StatusCode)
	}

	// Valid token → 200 with correct user_id and organization_id
	resp, result := doReq(app, "GET", "/users/me", nil, token)
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	data := result["data"].(map[string]interface{})
	if data["id"] != "test-user-id" {
		t.Errorf("Expected id=test-user-id, got %v", data["id"])
	}
	if data["organization_id"] != "test-org-id" {
		t.Errorf("Expected organization_id=test-org-id, got %v", data["organization_id"])
	}
}

func TestDashboardEndpoint(t *testing.T) {
	app, token := newTestApp()
	resp, result := doReq(app, "GET", "/dashboard", nil, token)
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	data := result["data"].(map[string]interface{})
	for _, f := range []string{"total_receipts", "total_amount", "processed_count", "pending_count", "needs_review_count"} {
		if _, ok := data[f]; !ok {
			t.Errorf("Missing field: %s", f)
		}
	}
}

func TestListReceiptsEndpoint(t *testing.T) {
	app, token := newTestApp()
	resp, result := doReq(app, "GET", "/receipts/", nil, token)
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	data := result["data"].(map[string]interface{})
	for _, f := range []string{"receipts", "total", "limit", "offset"} {
		if _, ok := data[f]; !ok {
			t.Errorf("Missing field: %s", f)
		}
	}
}

func TestExportCSVEndpoint(t *testing.T) {
	app, token := newTestApp()
	req := httptest.NewRequest("GET", "/receipts/export/csv", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req, -1)
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if ct != "text/csv" {
		t.Errorf("Expected text/csv, got %s", ct)
	}
	cd := resp.Header.Get("Content-Disposition")
	if cd == "" {
		t.Error("Missing Content-Disposition header")
	}
}

func TestRulesValidation(t *testing.T) {
	app, token := newTestApp()
	cases := []struct {
		name string
		body map[string]interface{}
		code int
	}{
		{"valid vendor", map[string]interface{}{"condition_type": "vendor", "condition_value": "Amazon", "action_type": "set_category", "action_value": "Shopping"}, 201},
		{"valid category", map[string]interface{}{"condition_type": "category", "condition_value": "Food", "action_type": "recurring", "action_value": "monthly"}, 201},
		{"invalid condition_type", map[string]interface{}{"condition_type": "bad", "condition_value": "x", "action_type": "set_category", "action_value": "y"}, 400},
		{"invalid action_type", map[string]interface{}{"condition_type": "vendor", "condition_value": "x", "action_type": "bad", "action_value": "y"}, 400},
		{"missing fields", map[string]interface{}{"condition_type": "vendor"}, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, _ := doReq(app, "POST", "/rules/", tc.body, token)
			if resp.StatusCode != tc.code {
				t.Errorf("Expected %d, got %d", tc.code, resp.StatusCode)
			}
		})
	}
}

func TestExceptionsEndpoints(t *testing.T) {
	app, token := newTestApp()
	resp, _ := doReq(app, "GET", "/exceptions/", nil, token)
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	resp, _ = doReq(app, "POST", "/exceptions/test-id/resolve", map[string]interface{}{"vendor_name": "X", "category": "Y"}, token)
	if resp.StatusCode != 200 {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestAPIResponseFormat(t *testing.T) {
	app, _ := newTestApp()
	resp, result := doReq(app, "GET", "/health", nil, "")
	if resp.StatusCode != 200 {
		t.Fatalf("Expected 200, got %d", resp.StatusCode)
	}
	if _, ok := result["success"]; !ok {
		t.Error("Missing 'success' field")
	}
	if result["success"] == true {
		if _, ok := result["data"]; !ok {
			t.Error("Success response missing 'data' field")
		}
	}
}

func TestErrorResponseFormat(t *testing.T) {
	app, _ := newTestApp()
	resp, result := doReq(app, "GET", "/users/me", nil, "")
	if resp.StatusCode != 401 {
		t.Fatalf("Expected 401, got %d", resp.StatusCode)
	}
	if result["success"] != false {
		t.Errorf("Expected success=false, got %v", result["success"])
	}
	if result["error"] == nil || result["error"] == "" {
		t.Error("Error response missing 'error' field")
	}
}



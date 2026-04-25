package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"

	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/database"
)

type fakeCache struct {
	values map[string]string
}

func newFakeCache() *fakeCache {
	return &fakeCache{values: map[string]string{}}
}

func (f *fakeCache) Get(key string) (string, error) {
	value, ok := f.values[key]
	if !ok {
		return "", cache.ErrCacheMiss
	}
	return value, nil
}

func (f *fakeCache) Set(key string, value interface{}, _ time.Duration) error {
	switch v := value.(type) {
	case []byte:
		f.values[key] = string(v)
	case string:
		f.values[key] = v
	default:
		raw, err := json.Marshal(v)
		if err != nil {
			return err
		}
		f.values[key] = string(raw)
	}
	return nil
}

func (f *fakeCache) SetJSON(key string, value any, ttl time.Duration) error {
	return f.Set(key, value, ttl)
}

func (f *fakeCache) DeleteByPrefix(prefix string) error {
	for key := range f.values {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(f.values, key)
		}
	}
	return nil
}

func TestDashboardStatsUsesCache(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	cacheClient := newFakeCache()
	handler := NewDashboardHandler(&database.PostgresDB{DB: sqlDB}, cacheClient, time.Minute)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", "user-1")
		return c.Next()
	})
	app.Get("/stats", handler.Stats)

	mock.ExpectQuery("SELECT COALESCE\\(SUM\\(amount\\), 0\\) FROM expenses WHERE user_id = \\$1").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(55.25))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM receipts WHERE user_id = \\$1").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM expenses WHERE user_id = \\$1").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	firstReq := httptest.NewRequest(http.MethodGet, "/stats", nil)
	firstResp, err := app.Test(firstReq)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	if firstResp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected first status: %d", firstResp.StatusCode)
	}
	if firstResp.Header.Get("X-Cache") != "MISS" {
		t.Fatalf("expected first request to miss cache")
	}

	secondReq := httptest.NewRequest(http.MethodGet, "/stats", nil)
	secondResp, err := app.Test(secondReq)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	if secondResp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected second status: %d", secondResp.StatusCode)
	}
	if secondResp.Header.Get("X-Cache") != "HIT" {
		t.Fatalf("expected second request to hit cache")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

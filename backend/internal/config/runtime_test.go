package config

import "testing"

func TestLoadRuntimeConfigProductionValidation(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("JWT_SECRET", "too-short")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("DATABASE_URL", "postgres://example")

	if _, err := LoadRuntimeConfig(); err == nil {
		t.Fatalf("expected validation error for short production JWT secret")
	}
}

func TestLoadRuntimeConfigTrustedProxies(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", "10.0.0.0/8, 192.168.1.10")
	t.Setenv("JWT_SECRET", "this-is-a-long-enough-secret-for-tests")

	cfg, err := LoadRuntimeConfig()
	if err != nil {
		t.Fatalf("unexpected config error: %v", err)
	}

	if !cfg.EnableProxyTrust {
		t.Fatalf("expected proxy trust to be enabled")
	}
	if len(cfg.TrustedProxies) != 2 {
		t.Fatalf("expected 2 trusted proxies, got %d", len(cfg.TrustedProxies))
	}
}

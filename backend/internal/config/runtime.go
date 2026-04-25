package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type RuntimeConfig struct {
	AppEnv             string
	Port               string
	CORSAllowedOrigins string
	TrustedProxies     []string
	EnableProxyTrust   bool
	RateLimitMax       int
	RateLimitWindow    time.Duration
	DashboardCacheTTL  time.Duration
	ShutdownTimeout    time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	IdleTimeout        time.Duration
	BodyLimit          int
	RequestIDHeader    string
	RequestTimeout     time.Duration
	Prefork            bool
	DisableStartupLog  bool
}

func LoadRuntimeConfig() (RuntimeConfig, error) {
	cfg := RuntimeConfig{
		AppEnv:             getEnv("ENVIRONMENT", "development"),
		Port:               getEnv("PORT", "8080"),
		CORSAllowedOrigins: strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")),
		RequestIDHeader:    getEnv("REQUEST_ID_HEADER", "X-Request-ID"),
	}

	var err error
	if cfg.RateLimitMax, err = getEnvInt("RATE_LIMIT_MAX", 100); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.RateLimitWindow, err = getEnvDuration("RATE_LIMIT_WINDOW", time.Minute); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.DashboardCacheTTL, err = getEnvDuration("DASHBOARD_CACHE_TTL", 30*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.ShutdownTimeout, err = getEnvDuration("SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.ReadTimeout, err = getEnvDuration("READ_TIMEOUT", 30*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.WriteTimeout, err = getEnvDuration("WRITE_TIMEOUT", 30*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.IdleTimeout, err = getEnvDuration("IDLE_TIMEOUT", 120*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.RequestTimeout, err = getEnvDuration("REQUEST_TIMEOUT", 15*time.Second); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.BodyLimit, err = getEnvInt("BODY_LIMIT_BYTES", 10*1024*1024); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.Prefork, err = getEnvBool("ENABLE_PREFORK", false); err != nil {
		return RuntimeConfig{}, err
	}
	if cfg.DisableStartupLog, err = getEnvBool("DISABLE_STARTUP_MESSAGE", false); err != nil {
		return RuntimeConfig{}, err
	}

	cfg.TrustedProxies = splitCSV(os.Getenv("TRUSTED_PROXIES"))
	cfg.EnableProxyTrust = len(cfg.TrustedProxies) > 0

	if err := cfg.Validate(); err != nil {
		return RuntimeConfig{}, err
	}

	return cfg, nil
}

func (c RuntimeConfig) Validate() error {
	if c.Port == "" {
		return fmt.Errorf("PORT must not be empty")
	}
	if c.RateLimitMax <= 0 {
		return fmt.Errorf("RATE_LIMIT_MAX must be greater than zero")
	}
	if c.RateLimitWindow <= 0 {
		return fmt.Errorf("RATE_LIMIT_WINDOW must be greater than zero")
	}
	if c.DashboardCacheTTL <= 0 {
		return fmt.Errorf("DASHBOARD_CACHE_TTL must be greater than zero")
	}
	if c.ShutdownTimeout <= 0 {
		return fmt.Errorf("SHUTDOWN_TIMEOUT must be greater than zero")
	}
	if c.ReadTimeout <= 0 || c.WriteTimeout <= 0 || c.IdleTimeout <= 0 {
		return fmt.Errorf("READ_TIMEOUT, WRITE_TIMEOUT, and IDLE_TIMEOUT must be greater than zero")
	}
	if c.BodyLimit <= 0 {
		return fmt.Errorf("BODY_LIMIT_BYTES must be greater than zero")
	}

	if strings.EqualFold(c.AppEnv, "production") {
		if len(strings.TrimSpace(os.Getenv("JWT_SECRET"))) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters in production")
		}
		if c.CORSAllowedOrigins == "" || c.CORSAllowedOrigins == "*" {
			return fmt.Errorf("CORS_ALLOWED_ORIGINS must be explicitly configured in production")
		}
		if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" && strings.TrimSpace(os.Getenv("DATABASE_HOST")) == "" {
			return fmt.Errorf("DATABASE_URL or DATABASE_HOST must be configured in production")
		}
	}

	return nil
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a valid integer: %w", key, err)
	}
	return parsed, nil
}

func getEnvDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a valid duration: %w", key, err)
	}
	return parsed, nil
}

func getEnvBool(key string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be a valid boolean: %w", key, err)
	}
	return parsed, nil
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		clean := strings.TrimSpace(part)
		if clean != "" {
			values = append(values, clean)
		}
	}
	return values
}

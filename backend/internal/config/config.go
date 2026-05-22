package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type Config struct {
	Port              string
	DatabaseURL       string
	RedisURL          string
	JWTSecret         string
	Environment       string
	SupabaseURL       string
	SupabaseKey       string
	SupabaseBucket    string
	MaxFileSize       int64
	OpenAIKey         string
	OpenAIModel       string
	GeminiKey         string
	WorkerConcurrency int
	RequestTimeout    time.Duration
	AppURL            string
	SMTPHost          string
	SMTPPort          int
	SMTPUser          string
	SMTPPass          string
	SMTPFrom          string
}

func Load() *Config {
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		if err := godotenv.Load(); err != nil {
			log.Warn().Msg("No .env file found, using system environment variables")
		}
	}

	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", ""),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:         getEnv("JWT_SECRET", ""),
		Environment:       getEnv("ENVIRONMENT", "development"),
		SupabaseURL:       getEnv("SUPABASE_URL", ""),
		SupabaseKey:       getEnv("SUPABASE_KEY", getEnv("SUPABASE_SERVICE_ROLE_KEY", "")),
		SupabaseBucket:    getEnv("SUPABASE_BUCKET", getEnv("SUPABASE_STORAGE_BUCKET", "receipts")),
		MaxFileSize:       getEnvInt64("MAX_FILE_SIZE", 10*1024*1024),
		OpenAIKey:         getEnv("OPENAI_KEY", getEnv("OPENAI_API_KEY", "")),
		OpenAIModel:       getEnv("OPENAI_MODEL", getEnv("OPEN_MODEL", "gpt-4o")),
		GeminiKey:         getEnv("GEMINI_API_KEY", ""),
		WorkerConcurrency: getEnvInt("WORKER_CONCURRENCY", 5),
		RequestTimeout:    time.Duration(getEnvInt("REQUEST_TIMEOUT_SECONDS", 10)) * time.Second,
		AppURL:            getEnv("APP_URL", getEnv("FRONTEND_URL", "https://receiptmind.vercel.app")),
		SMTPHost:          getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:          getEnvInt("SMTP_PORT", 465),
		SMTPUser:          getEnv("SMTP_USERNAME", ""),
		SMTPPass:          getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:          getEnv("SMTP_FROM", "ReceiptMind <noreply@receiptmind.com>"),
	}

	if cfg.GeminiKey != "" {
		log.Info().Msg("Gemini API Key loaded (Free Tier Active)")
	} else if cfg.OpenAIKey == "" {
		log.Warn().Msg("No AI API Keys found! Extraction will fail.")
	}

	return cfg
}

func (c *Config) Validate() error {
	var errs []string

	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	if c.RedisURL == "" {
		errs = append(errs, "REDIS_URL is required")
	}
	if c.JWTSecret == "" {
		errs = append(errs, "JWT_SECRET is required")
	} else if len(c.JWTSecret) < 32 && !c.IsDevelopment() {
		errs = append(errs, "JWT_SECRET must be at least 32 characters in production")
	}
	// if c.SupabaseURL == "" {
	// 	errs = append(errs, "SUPABASE_URL is required")
	// }
	// if c.SupabaseKey == "" {
	// 	errs = append(errs, "SUPABASE_KEY is required")
	// }

	if len(errs) > 0 {
		return fmt.Errorf("config validation failed: %v", errs)
	}

	return nil
}

func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

func (c *Config) MaxDBConns() int {
	return getEnvInt("MAX_DB_CONNS", 15)
}

func (c *Config) MinDBConns() int {
	return getEnvInt("MIN_DB_CONNS", 2)
}

func (c *Config) MaxConnLifetime() time.Duration {
	return time.Duration(getEnvInt("MAX_CONN_LIFETIME_MINUTES", 30)) * time.Minute
}

func (c *Config) AccessTokenExpiry() time.Duration {
	return time.Duration(getEnvInt("ACCESS_TOKEN_EXPIRY_MINUTES", 15)) * time.Minute
}

func (c *Config) RefreshTokenExpiry() time.Duration {
	return time.Duration(getEnvInt("REFRESH_TOKEN_EXPIRY_DAYS", 7)) * 24 * time.Hour
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.ParseInt(val, 10, 64); err == nil {
			return i
		}
	}
	return fallback
}



package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type PostgresDB struct {
	DB *sql.DB
}

func NewPostgresDB() (*PostgresDB, error) {
	if directURL := os.Getenv("DATABASE_URL"); directURL != "" {
		db, err := sql.Open("postgres", directURL)
		if err != nil {
			return nil, fmt.Errorf("failed to open database from DATABASE_URL: %w", err)
		}

		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(10)
		db.SetConnMaxLifetime(5 * time.Minute)

		if err := db.Ping(); err != nil {
			return nil, fmt.Errorf("failed to ping database from DATABASE_URL: %w", err)
		}

		log.Println("PostgreSQL connected successfully using DATABASE_URL")
		return &PostgresDB{DB: db}, nil
	}

	host := os.Getenv("DATABASE_HOST")
	port := os.Getenv("DATABASE_PORT")
	user := os.Getenv("DATABASE_USER")
	password := os.Getenv("DATABASE_PASSWORD")
	dbname := os.Getenv("DATABASE_NAME")
	sslmode := os.Getenv("DATABASE_SSL_MODE")
	if sslmode == "" {
		sslmode = "require"
	}

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("PostgreSQL connected successfully")
	return &PostgresDB{DB: db}, nil
}

func (p *PostgresDB) Close() error {
	return p.DB.Close()
}

func (p *PostgresDB) RunMigrations() error {
	migrations := []string{
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			name VARCHAR(255),
			role VARCHAR(50) DEFAULT 'user',
			avatar_url TEXT,
			company_name VARCHAR(255),
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			ip_address INET,
			user_agent TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS receipts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			filename VARCHAR(255) NOT NULL,
			file_url TEXT NOT NULL,
			file_size BIGINT,
			mime_type VARCHAR(100),
			status VARCHAR(50) DEFAULT 'pending',
			vendor_name VARCHAR(255),
			amount DECIMAL(10,2),
			currency VARCHAR(3) DEFAULT 'USD',
			receipt_date DATE,
			category VARCHAR(100),
			description TEXT,
			raw_ocr_text TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			processed_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS expenses (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
			vendor_name VARCHAR(255) NOT NULL,
			amount DECIMAL(10,2) NOT NULL,
			currency VARCHAR(3) DEFAULT 'USD',
			expense_date DATE NOT NULL,
			category VARCHAR(100),
			description TEXT,
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS api_keys (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			key_hash VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			last_used_at TIMESTAMPTZ,
			expires_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE SET NULL,
			action VARCHAR(100) NOT NULL,
			resource_id VARCHAR(255),
			ip_address INET,
			user_agent TEXT,
			metadata JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS billing_profiles (
			user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			plan_name VARCHAR(100) NOT NULL DEFAULT 'Pro',
			billing_interval VARCHAR(50) NOT NULL DEFAULT 'monthly',
			status VARCHAR(50) NOT NULL DEFAULT 'active',
			next_renewal_date DATE NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS invoices (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			invoice_number VARCHAR(100) NOT NULL,
			amount DECIMAL(10,2) NOT NULL,
			currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			status VARCHAR(50) NOT NULL DEFAULT 'paid',
			issued_at DATE NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS team_members (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			email VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'viewer',
			status VARCHAR(50) NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS integrations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			slug VARCHAR(100) NOT NULL,
			name VARCHAR(255) NOT NULL,
			category VARCHAR(100) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
			connected_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, slug)
		)`,
		`CREATE TABLE IF NOT EXISTS onboarding_steps (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			step_key VARCHAR(100) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT NOT NULL,
			position INT NOT NULL,
			completed BOOLEAN NOT NULL DEFAULT FALSE,
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, step_key)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`,
		`CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_team_members_owner_user_id ON team_members(owner_user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_onboarding_steps_user_id ON onboarding_steps(user_id)`,
	}

	for _, migration := range migrations {
		if _, err := p.DB.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	log.Println("Database migrations completed")
	return nil
}

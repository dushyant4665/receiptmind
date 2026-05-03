package database

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"
)

func RunMigrations(ctx context.Context, db *Database) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS organizations (
			id UUID PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			organization_id UUID NOT NULL REFERENCES organizations(id),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			refresh_token TEXT NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token)`,
		`CREATE TABLE IF NOT EXISTS receipts (
			id UUID PRIMARY KEY,
			organization_id UUID NOT NULL REFERENCES organizations(id),
			user_id UUID NOT NULL REFERENCES users(id),
			file_path TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			raw_vendor_name TEXT,
			raw_amount NUMERIC,
			raw_date TIMESTAMP WITH TIME ZONE,
			raw_category TEXT,
			raw_confidence DOUBLE PRECISION,
			vendor_name TEXT,
			amount NUMERIC,
			receipt_date TIMESTAMP WITH TIME ZONE,
			category TEXT,
			confidence DOUBLE PRECISION,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_receipts_org_created ON receipts(organization_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status)`,
		`CREATE TABLE IF NOT EXISTS exceptions (
			id UUID PRIMARY KEY,
			receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
			organization_id UUID NOT NULL REFERENCES organizations(id),
			type TEXT NOT NULL,
			field TEXT NOT NULL,
			message TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'open',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_exceptions_org ON exceptions(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exceptions_receipt ON exceptions(receipt_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status)`,
		`CREATE TABLE IF NOT EXISTS rules (
			id UUID PRIMARY KEY,
			organization_id UUID NOT NULL REFERENCES organizations(id),
			condition_type TEXT NOT NULL,
			condition_value TEXT NOT NULL,
			action_type TEXT NOT NULL,
			action_value TEXT NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_rules_org ON rules(organization_id)`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT 'temp'`,
		`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_slug_key`,
		`ALTER TABLE organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug)`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id UUID`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_path TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_vendor_name TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_amount NUMERIC`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_date TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_category TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_confidence DOUBLE PRECISION`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vendor_name TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS amount NUMERIC`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_date TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS field TEXT`,
		`ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS message TEXT`,
		`ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_status_check`,
		`UPDATE receipts SET status = 'pending' WHERE status NOT IN ('pending', 'processing', 'processed', 'needs_review', 'failed', 'error')`,
		`ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('pending', 'processing', 'processed', 'needs_review', 'failed', 'error'))`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_url TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_name TEXT`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload'`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_extraction JSONB NOT NULL DEFAULT '{}'`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_corrections JSONB NOT NULL DEFAULT '{}'`,
		`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
	}

	for i, m := range migrations {
		_, err := db.Pool.Exec(ctx, m)
		if err != nil {
			return fmt.Errorf("migration %d failed: %w", i+1, err)
		}
	}

	log.Info().Msg("Database migrations completed")
	return nil
}

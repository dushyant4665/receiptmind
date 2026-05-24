const db = require('../config/db');

const runMigrations = async () => {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL DEFAULT '',
      email_verified_at TIMESTAMP WITH TIME ZONE,
      status TEXT NOT NULL DEFAULT 'active',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL,
      refresh_token_hash TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      revoked_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token)`,
    `CREATE TABLE IF NOT EXISTS receipts (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      file_path TEXT NOT NULL,
      file_url TEXT,
      file_name TEXT,
      file_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      processing_state TEXT NOT NULL DEFAULT 'queued',
      currency TEXT NOT NULL DEFAULT 'USD',
      amount NUMERIC,
      vendor_name TEXT,
      receipt_date TIMESTAMP WITH TIME ZONE,
      category TEXT,
      confidence DOUBLE PRECISION,
      validation_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
      needs_review BOOLEAN NOT NULL DEFAULT false,
      source TEXT NOT NULL DEFAULT 'upload',
      line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      raw_extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
      user_corrections JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_vendor_name TEXT,
      raw_amount NUMERIC,
      raw_date TIMESTAMP WITH TIME ZONE,
      raw_category TEXT,
      raw_confidence DOUBLE PRECISION,
      raw_text TEXT NOT NULL DEFAULT '',
      ai_output JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_billable BOOLEAN NOT NULL DEFAULT false,
      is_reimbursable BOOLEAN NOT NULL DEFAULT false,
      processing_started_at TIMESTAMP WITH TIME ZONE,
      processing_finished_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE,
      CONSTRAINT receipts_status_check CHECK (status IN ('pending', 'processing', 'processed', 'needs_review', 'failed', 'error'))
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
    `CREATE TABLE IF NOT EXISTS rule_learning_events (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      vendor TEXT NOT NULL,
      chosen_category TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rule_learning_org_vendor ON rule_learning_events(organization_id, vendor)`,
    `CREATE TABLE IF NOT EXISTS vendor_aliases (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      canonical_vendor TEXT NOT NULL,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE,
      UNIQUE (organization_id, normalized_alias)
    )`,
    `CREATE TABLE IF NOT EXISTS storage_objects (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
      path TEXT NOT NULL UNIQUE,
      file_hash TEXT,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      content_type TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    )`,
    `CREATE TABLE IF NOT EXISTS receipt_processing_jobs (
      id UUID PRIMARY KEY,
      receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      queue_job_id TEXT,
      processing_state TEXT NOT NULL DEFAULT 'queued',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      last_error TEXT,
      started_at TIMESTAMP WITH TIME ZONE,
      finished_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS export_history (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      export_type TEXT NOT NULL DEFAULT 'csv',
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      row_count INT NOT NULL DEFAULT 0,
      file_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS pending_registrations (
      id UUID,
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_registrations') THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'pending_registrations' AND constraint_type = 'UNIQUE'
          AND constraint_name = 'pending_registrations_email_key'
        ) THEN
          ALTER TABLE pending_registrations ADD CONSTRAINT pending_registrations_email_key UNIQUE (email);
        END IF;
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
  ];

  for (const m of migrations) {
    try {
      await db.query(m);
    } catch (err) {
      console.error('Migration failed:', m);
      console.error(err);
      throw err;
    }
  }
  console.log('Database migrations completed successfully');
};

module.exports = runMigrations;

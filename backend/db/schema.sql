CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS sessions (
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
);

CREATE TABLE IF NOT EXISTS receipts (
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
);

CREATE TABLE IF NOT EXISTS exceptions (
    id UUID PRIMARY KEY,
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type TEXT NOT NULL,
    field TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rules (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    condition_type TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_value TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS rule_learning_events (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    vendor TEXT NOT NULL,
    chosen_category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_aliases (
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
);

CREATE TABLE IF NOT EXISTS storage_objects (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    path TEXT NOT NULL UNIQUE,
    file_hash TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    content_type TEXT,
    retention_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS receipt_processing_jobs (
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
);

CREATE TABLE IF NOT EXISTS export_history (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    export_type TEXT NOT NULL DEFAULT 'csv',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_count INT NOT NULL DEFAULT 0,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_digest_runs (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    digest_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_receipts_org_created ON receipts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_vendor ON receipts(vendor_name);
CREATE INDEX IF NOT EXISTS idx_receipts_amount ON receipts(amount);
CREATE INDEX IF NOT EXISTS idx_receipts_file_hash ON receipts(file_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_org_processing_state ON receipts(organization_id, processing_state);
CREATE INDEX IF NOT EXISTS idx_receipts_org_status_created ON receipts(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_org_vendor ON receipts(organization_id, vendor_name);
CREATE INDEX IF NOT EXISTS idx_receipts_org_date ON receipts(organization_id, receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_not_deleted ON receipts(organization_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exceptions_org ON exceptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_receipt ON exceptions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_rules_org ON rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rule_learning_org_vendor ON rule_learning_events(organization_id, vendor);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_org_alias ON vendor_aliases(organization_id, normalized_alias) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_canonical ON vendor_aliases(organization_id, canonical_vendor) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_org_created ON storage_objects(organization_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_receipt ON storage_objects(receipt_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_processing_jobs_receipt ON receipt_processing_jobs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_org_state ON receipt_processing_jobs(organization_id, processing_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_state ON receipt_processing_jobs(processing_state);
CREATE INDEX IF NOT EXISTS idx_export_history_org_created ON export_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS pending_registrations (
    id UUID,
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_registrations_email_unique ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);

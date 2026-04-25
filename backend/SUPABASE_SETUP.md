# ReceiptMind Supabase Setup

ReceiptMind is an AI financial operations layer, not a basic receipt uploader.
This foundation is designed for:

- multi-tenant organizations
- firm mode with multiple clients
- AI extraction with confidence routing
- integrations with accounting, banking, email, and billing
- exception-first human review

## 1. Create the Supabase project

1. Go to `https://supabase.com`
2. Click `New Project`
3. Name it `receiptmind`
4. Choose region: `Southeast Asia (Singapore)`
5. Generate and save a strong database password
6. Wait for provisioning to finish

## 2. Copy project secrets

From `Project Settings -> API`, copy:

- `Project URL`
- `anon / public key`
- `service_role key`

From `Project Settings -> Database`, copy either:

- `Connection string`
- or the separate host / port / user / password values

## 3. Update local environment files

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXTAUTH_SECRET=replace-with-a-strong-random-secret
NEXTAUTH_URL=http://localhost:3000
```

### Backend `.env`

```env
PORT=8080
ENVIRONMENT=development

DATABASE_URL=postgresql://postgres.your-project:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=receipts

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=replace-with-a-strong-random-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

OPENAI_API_KEY=sk-proj-your-openai-key

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
POSTMARK_API_KEY=
POSTMARK_INBOUND_WEBHOOK_SECRET=
QBO_CLIENT_ID=
QBO_CLIENT_SECRET=
QBO_REDIRECT_URI=
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=

CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## 4. Run the SQL schema

Open the Supabase SQL editor and run:

- [db/schema.sql](./db/schema.sql)

That creates:

- `organizations`
- `users`
- `clients`
- `receipts`
- `bank_transactions`
- `expenses`
- `category_rules`
- `exceptions`
- `email_inboxes`
- `integrations`
- `team_invites`
- `approval_requests`
- `mileage_logs`
- `share_links`
- `audit_logs`
- `receipts` storage bucket
- RLS policies
- auto-profile creation trigger
- helper functions for free-plan enforcement and duplicate detection

## 5. Notes

- `service_role` must never be exposed to the browser.
- The frontend should use the anon key only.
- Receipt uploads should land in `receipts/<auth.uid()>/...`.
- The current repo still contains a Go API, but this schema now matches the larger Supabase-first product architecture.
- The next implementation step is the extraction pipeline:
  upload -> storage -> pending receipt row -> GPT-4o extraction -> rule engine -> exceptions inbox.

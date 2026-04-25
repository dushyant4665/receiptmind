# ReceiptMind Supabase Setup

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
SUPABASE_STORAGE_BUCKET=receipt-files

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=replace-with-a-strong-random-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

OPENAI_API_KEY=sk-proj-your-openai-key

CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## 4. Run the SQL schema

Open the Supabase SQL editor and run:

- [db/schema.sql](./db/schema.sql)

That creates:

- `users`
- `sessions`
- `receipts`
- `expenses`
- `api_keys`
- `audit_logs`
- `receipt-files` storage bucket
- RLS policies

## 5. Notes

- `service_role` must never be exposed to the browser.
- The Go backend should use `service_role` for privileged storage operations.
- The frontend should use the anon key only.
- Receipt files are stored in a private storage bucket; the backend should generate access URLs when needed.

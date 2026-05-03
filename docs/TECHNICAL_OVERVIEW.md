# ReceiptMind Technical Overview

Last reviewed: 2026-04-28

## Purpose

ReceiptMind is intended to be an AI-powered receipt, invoice, and expense automation platform. The product vision includes document upload, AI extraction, categorization rules, exception review, reporting, billing, team workflows, and future accounting/banking integrations.

This document explains what the current repository contains, how the pieces fit together, and where the implementation is incomplete or inconsistent.

## Repository Layout

```text
receiptmind-enterprise/
  backend/
    cmd/api/                 Go API entry point and route registration
    db/schema.sql            Enterprise Supabase/Postgres schema
    internal/cache/          Redis cache wrapper
    internal/config/         Runtime configuration
    internal/database/       Postgres connection and simple migrations
    internal/handlers/       HTTP route handlers
    internal/middleware/     Auth, CORS, rate limit middleware
    internal/models/         Go response/data structs
    internal/services/       Auth, storage, OpenAI, Gemini services
    pkg/utils/               Shared response/JWT helpers
  frontend/
    app/                     Next.js app router pages
    components/              UI, dashboard, landing, expense components
    hooks/                   React Query hooks for API data
    lib/                     API client, env helpers, auth config
    types/                   Shared TypeScript types
  docs/                      Project documentation
```

## Technology Stack

### Backend

- Language: Go
- HTTP framework: Fiber
- Database: PostgreSQL
- Optional cache: Redis
- Auth: Custom JWT-based authentication
- File storage: Supabase Storage through REST API
- AI extraction:
  - Gemini API, preferred first
  - OpenAI API fallback
- Billing: Stripe checkout started, webhook incomplete

### Frontend

- Framework: Next.js
- React version: React 19
- Auth session layer: NextAuth credentials provider
- Data fetching: TanStack React Query
- HTTP client: Axios
- Styling: Tailwind CSS plus local UI components
- UI libraries: Radix, lucide-react, sonner

## Backend Startup Flow

The backend starts from `backend/cmd/api/main.go`.

1. Loads `.env` if present.
2. Loads runtime config from environment variables.
3. Connects to PostgreSQL.
4. Runs migrations from `internal/database/postgres.go`.
5. Attempts Redis connection.
6. Initializes auth, AI, and storage services.
7. Registers routes in `cmd/api/app.go`.
8. Starts Fiber on `PORT`, default `8080`.

## Backend Routes

Base path: `/api/v1`

### Public Routes

```text
GET  /health
GET  /ready
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
```

### Protected Routes

All protected routes require:

```text
Authorization: Bearer <access_token>
```

```text
POST   /api/v1/checkout

GET    /api/v1/users/me
PUT    /api/v1/users/me

POST   /api/v1/receipts/upload
GET    /api/v1/receipts
GET    /api/v1/receipts/:id
DELETE /api/v1/receipts/:id
GET    /api/v1/receipts/export/csv

POST   /api/v1/expenses
GET    /api/v1/expenses
GET    /api/v1/expenses/:id
PUT    /api/v1/expenses/:id
DELETE /api/v1/expenses/:id

GET    /api/v1/dashboard/stats
GET    /api/v1/dashboard/activity

GET    /api/v1/rules
POST   /api/v1/rules
GET    /api/v1/rules/:id
PUT    /api/v1/rules/:id
DELETE /api/v1/rules/:id
POST   /api/v1/rules/apply/:receipt_id

GET    /api/v1/exceptions
GET    /api/v1/exceptions/stats
GET    /api/v1/exceptions/:id
POST   /api/v1/exceptions
POST   /api/v1/exceptions/:id/resolve
POST   /api/v1/exceptions/:id/dismiss

GET    /api/v1/sse/stream
```

## Current Backend Capabilities

### Authentication

Implemented:

- Register
- Login
- JWT access token generation
- Refresh token generation
- Session storage
- Logout
- Protected-route middleware

Incomplete:

- Forgot password only returns a safe success message.
- No email sending.
- Refresh token lookup scans recent sessions instead of direct token indexing.
- Auth model conflicts with Supabase auth assumptions in `db/schema.sql`.

### Receipts

Implemented:

- Multi-file upload using multipart field `receipts`.
- Supabase Storage upload service.
- AI extraction attempt using Gemini first, then OpenAI fallback.
- Receipt list, detail, delete, CSV export.
- Low-confidence exception creation attempt.

Incomplete or risky:

- Backend handler uses older columns such as `user_id`, `filename`, `file_size`, and `mime_type`.
- Enterprise schema uses `organization_id`, `file_name`, `file_size_bytes`, and `file_type`.
- Extraction runs synchronously during upload.
- No job queue.
- No duplicate detection wired into upload flow.
- No signed file URL returned to frontend for private Supabase files.
- No update/edit receipt endpoint.

### Expenses

Implemented:

- Create expense.
- List expenses.
- Get one expense.
- Update expense.
- Delete expense.

Incomplete:

- Expense table exists only in simple backend migrations, not in the enterprise `db/schema.sql`.
- No approval flow.
- No receipt-to-expense posting workflow.
- No accounting sync.

### Dashboard

Implemented:

- Total spent.
- Receipt count.
- Expense count.
- Recent receipt activity.
- Optional Redis caching.

Incomplete:

- Metrics are basic.
- No date-range filters.
- No organization-level dashboard.
- No true accuracy/time-saved calculations.

### Category Rules

Implemented:

- CRUD endpoints.
- Rule application based on vendor, amount, and description.
- Rule cache invalidation.

Incomplete:

- Uses `user_id`, while enterprise schema uses `organization_id`.
- Rule application updates only category/status, not all action fields.
- No frontend management page found for rules.

### Exceptions

Implemented:

- Create/list/get exceptions.
- Resolve and dismiss exceptions.
- Exception stats endpoint.
- Exceptions dashboard page exists in frontend.

Incomplete:

- Uses `user_id`, while enterprise schema uses `organization_id`.
- Exception creation from receipt extraction is basic.
- No policy engine.
- No assignment/approval workflow.

### Stripe Billing

Implemented:

- Checkout session creation for `pro_monthly` and `pro_yearly`.

Broken/incomplete:

- Backend currently fails to compile because Stripe packages are imported but missing from `go.mod`.
- Webhook handler is TODO.
- No subscription state update.
- No plan enforcement.
- No billing portal.
- No receipt limit enforcement.

### Storage

Implemented:

- Upload to Supabase Storage through REST API.
- Stores a `supabase://bucket/path` reference.
- Signed URL helper exists.

Incomplete:

- Current upload code does not return signed browser-viewable URLs.
- Default bucket in storage service is `receipt-files`, while `db/schema.sql` creates bucket `receipts`.

## Frontend Capabilities

Implemented:

- Marketing pages: home, features, pricing, about, blog, contact, security, privacy, terms, API docs, changelog.
- Auth pages: login, signup, forgot password.
- Dashboard shell with navigation.
- Dashboard page with metrics, activity, expense table, upload.
- Receipts page with upload, search, status filter, CSV export.
- Receipt detail page.
- Expenses page.
- Reports page based on expense data.
- Exceptions page connected to backend endpoints.
- Settings pages for billing, team, API, profile-style settings.

Incomplete or placeholder:

- Billing page uses hardcoded plan/invoice data.
- Team page uses hardcoded members and does not submit invites.
- Integrations page uses static connected/connect states.
- API settings page appears UI-only.
- Contact form only shows a coming-soon alert.
- Reports are basic client-side summaries.
- Pricing checkout tries `/checkout`, but auth/session behavior must be verified.

## Critical Architecture Issue

The project currently has two competing backend data models.

### Simple Backend Migration Model

Defined in:

```text
backend/internal/database/postgres.go
```

This model creates tables like:

- `users`
- `sessions`
- `receipts`
- `expenses`
- `api_keys`
- `billing_profiles`
- `invoices`
- `team_members`
- `integrations`
- `onboarding_steps`

It uses mostly `user_id` ownership.

### Enterprise Supabase Model

Defined in:

```text
backend/db/schema.sql
```

This model creates tables like:

- `organizations`
- `users`
- `clients`
- `bank_transactions`
- `receipts`
- `category_rules`
- `exceptions`
- `email_inboxes`
- `integrations`
- `team_invites`
- `approval_requests`
- `mileage_logs`
- `share_links`
- `audit_logs`

It uses mostly `organization_id` ownership and assumes Supabase auth.

### Impact

The handlers and tests mostly match the simple model. The roadmap and schema file point toward the enterprise model. Until this is resolved, the backend cannot reliably support the full product.

## Verification Status

Commands run on 2026-04-28:

```text
cd backend
go test ./...
```

Result:

```text
FAIL
no required module provides package github.com/stripe/stripe-go/v78
```

```text
cd frontend
npm.cmd run typecheck
```

Result:

```text
Pass
```

```text
cd frontend
npm.cmd run lint
```

Result:

```text
Fail: 4 errors, 7 warnings
```

Primary lint issues:

- `frontend/app/(dashboard)/exceptions/page.tsx`
- `frontend/tmp/playwright-flow-audit-prod.js`

## Recommended Engineering Order

1. Decide the canonical database model.
2. Make backend compile.
3. Align Go models, handlers, tests, and schema.
4. Make `go test ./...` pass.
5. Fix frontend lint.
6. Verify login, upload, receipt list, dashboard, expenses, exceptions end to end.
7. Implement Stripe webhook and plan enforcement.
8. Add receipt edit/review workflow.
9. Add async extraction worker.
10. Implement integrations after the core receipt workflow is stable.
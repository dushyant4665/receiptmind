# ReceiptMind Frontend

This package is the Next.js App Router frontend for ReceiptMind. It gives users the screens to sign in, upload receipts, track processing, review exceptions, and export data.

## What it handles

- User authentication flows
- Receipt upload and progress polling
- Receipt detail views with extracted fields and confidence signals
- Dashboard cards, filters, and review states
- Export access and exception workflows

## Folder layout

```text
frontend/
|- app/          # routes and page-level UI
|- components/   # reusable interface components
|- hooks/        # client-side data hooks
|- lib/          # API client, auth, env, shared utilities
|- public/       # static assets
`- types/        # shared TypeScript types
```

## Runtime notes

- API calls go through `NEXT_PUBLIC_API_URL` or `BACKEND_API_URL`
- NextAuth uses the frontend's own `/api/auth/*` routes, so backend requests should use explicit backend URLs
- `output: "standalone"` is enabled for production builds

## Environment variables

Base configuration is documented in [`.env.example`](./.env.example).

Important variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_API_URL`
- `BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Local run

```bash
npm install
npm run dev
```

## Vercel deployment

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm install`

Production environment values should point to the deployed backend URL, for example:

```text
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
BACKEND_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_APP_URL=https://your-frontend.vercel.app
NEXTAUTH_URL=https://your-frontend.vercel.app
```

## Integration boundary

The frontend should treat the backend as the source of truth for:

- receipt state
- extraction output
- export generation
- exception lifecycle
- auth email delivery

Brevo or other mail provider secrets must stay on the backend. The frontend only needs backend URL variables such as `NEXT_PUBLIC_API_URL` and `BACKEND_API_URL`.

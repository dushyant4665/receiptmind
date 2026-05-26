# ReceiptMind Frontend

The frontend is a Next.js App Router application for upload, review, analytics, exceptions, and export workflows.

## Responsibilities

- Authenticate users
- Submit receipt uploads
- Poll receipt processing status
- Render extracted data, confidence, and review states
- Provide dashboards, filters, and export access

## Folder Layout

```text
frontend/
|- app/          # routes and page-level UI
|- components/   # reusable interface components
|- hooks/        # client-side data hooks
|- lib/          # API client, auth, env, shared utilities
|- public/       # static assets
`- types/        # shared TypeScript types
```

## Runtime Notes

- API calls are routed through `NEXT_PUBLIC_API_URL` or `BACKEND_API_URL`.
- `next.config.js` rewrites `/api/*` traffic to the backend service.
- `output: "standalone"` is enabled for clean production builds.

## Environment Variables

Base configuration is documented in [`.env.example`](./.env.example).

Important variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_API_URL`
- `BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Local Run

```bash
npm install
npm run dev
```

## Vercel Deployment

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

## Integration Boundary

The frontend should treat the backend as the single source of truth for:

- receipt state
- extraction output
- export generation
- exception lifecycle

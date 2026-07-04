# ReceiptMind AI Gateway

This is a small standalone TypeScript + Express service for AI requests. It is separate from the receipt-processing backend and is useful when you want a lightweight gateway that can try one provider and fall back to another.

## What it does

- Accepts chat-style generation requests
- Normalizes messages into provider-specific payloads
- Calls OpenRouter first by default
- Falls back to Gemini when the first provider fails
- Uses Axios timeouts so slow providers do not block the request forever
- Retries retryable failures with exponential backoff

## Endpoints

- `GET /health`
- `POST /api/generate`

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy [`.env.example`](./.env.example) to `.env` and set at least one provider key.

Important variables:

- `PORT`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_APP_NAME`
- `OPENROUTER_APP_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODEL`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_MAX_RETRIES`

## Extra checks

```bash
npm run typecheck
npm run build
```

# ReceiptMind AI Gateway

Small TypeScript Express service that routes chat requests across OpenRouter and Gemini with Axios, retries, timeout handling, and automatic failover.

## Run

```bash
npm install
npm run dev
```

## Endpoints

- `GET /health`
- `POST /api/generate`

## Env

Copy [`.env.example`](./.env.example) to `.env` and fill at least one provider key.

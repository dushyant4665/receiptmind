# ReceiptMind Enterprise

ReceiptMind Enterprise is a monorepo with a Next.js frontend and an Express backend for receipt upload, AI extraction, review, rules, exceptions, and CSV export.

## Architecture

```mermaid
flowchart LR
    U[User] --> F[Next.js Frontend]
    F -->|REST API| B[Express Backend]
    B -->|SQL| D[(PostgreSQL)]
    B -->|File storage| S[Local storage]
    B -->|Primary extraction| O[OpenRouter]
    B -->|Fallback extraction| G[Gemini]
    B -->|OCR fallback| T[Tesseract]
    B -->|Email delivery| M[Brevo API]
    B --> R[Rules + exceptions]
    R --> D
```

## Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Storage
    participant AI
    participant DB

    User->>Frontend: Upload receipt
    Frontend->>Backend: POST /api/receipts/upload
    Backend->>Storage: Save file
    Backend->>DB: Create receipt and job
    Backend-->>Frontend: Return receipt id
    Backend->>AI: Extract fields
    AI-->>Backend: Structured data
    Backend->>Backend: Validate + apply rules
    Backend->>DB: Update receipt state
    Frontend->>Backend: Poll status
    Backend-->>Frontend: processed / needs_review / failed
```

## Structure

```text
receiptmind-enterprise/
|- backend/
|- frontend/
|- docs/
`- render.yaml
```

## Local Dev

- `npm run install:all`
- `npm run backend:dev`
- `npm run frontend:dev`

## Deploy

Frontend on Vercel:

- Root directory: `frontend`
- Build command: `npm run build`

Backend on Render:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

## Docs

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [System flow](docs/FLOW.md)

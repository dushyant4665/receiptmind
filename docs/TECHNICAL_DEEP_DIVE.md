# ReceiptMind Technical Deep-Dive (Confidential)

## 1. System Architecture Overview
The ReceiptMind Enterprise platform is a high-performance document processing pipeline built using a decoupled Micro-Frontend and Micro-Backend architecture.

- **Frontend:** Next.js 15 (App Router), TypeScript, TailwindCSS, TanStack Query (v5), NextAuth.js.
- **Backend:** Go (Golang) with Fiber (v2), PostgreSQL (Neon DB), Redis (Queue/Caching).
- **AI/ML:** Gemini 1.5 Flash (Primary) & OpenAI GPT-4o (Fallback) for document extraction.
- **Database:** PostgreSQL via pgx (v5) for relational data; Redis for worker queues.

---

## 2. Backend Deep-Dive (Go & Fiber)

### Core Components:
- **Server Setup (`internal/server`):** Uses Fiber for its extreme performance (Zero-allocations). Middleware includes Security Headers, CORS, Rate Limiting (Redis-backed), and Request Logging.
- **Database Layer (`internal/database`):** Uses `pgxpool` for efficient connection management with Neon DB. Schema-first design with complex indexes for receipt searching.
- **Auth Flow (Refactored):**
    - **Verify-then-Save:** Prevents DB pollution. Data is stored in `pending_registrations` until email verification.
    - **JWT Service:** Generates asymmetric Access Tokens and Refresh Tokens (7-day expiry).
    - **Security:** Argon2/Bcrypt for password hashing (via `pkg/utils`).

### Document Processing Pipeline (`internal/services`):
1. **Upload:** Files are stored in Supabase Storage or Local Storage.
2. **Queueing:** Redis-backed `QueueService` manages processing jobs.
3. **Pipeline Steps:**
    - **PDF Conversion:** `pdf_to_image.go` converts PDF pages to JPEGs.
    - **Preprocessing:** Images are converted to Grayscale with contrast lifting to enhance text clarity.
    - **OCR:** Multi-stage OCR (via `ocr_service.go`) extracts raw text.
    - **AI Extraction:** `ai_service.go` sends the image + OCR context to Gemini 1.5 Flash using high-density JSON prompts.
    - **Retry Logic:** If Gemini fails, it automatically falls back to OpenAI GPT-4o.
4. **Data Normalization:** Raw AI output is parsed into structured fields (Vendor, Amount, Date, Category) with confidence scores.

---

## 3. Frontend Deep-Dive (Next.js & TypeScript)

### State Management & Data Fetching:
- **TanStack Query:** Handles all server state. Implements polling (3s) for pending receipts to provide a "live" processing feel.
- **Axios Client:** Centrally managed in `lib/api-client.ts` with interceptors for JWT injection and 401 (Auto-Logout) handling.

### UI/UX Design System:
- **Styling:** Custom Vanilla CSS & Tailwind. Uses a high-contrast monochromatic theme with "Amber" accents.
- **Components:** Modular React components (Shadcn/UI base) for Receipts Table, Dashboard Charts (Recharts), and Exception Modals.
- **Responsive:** Fluid layout using CSS Variables for consistent spacing and typography.

---

## 4. Key Logic & Coding Concepts

### Verify-then-Save Signup Logic
Instead of creating a 'pending' user, we store data in `pending_registrations`.
```go
// Register Handler
token := uuid.New().String()
// Store everything in temporary table
h.DB.Pool.Exec(ctx, "INSERT INTO pending_registrations ...")
// Send Email
h.EmailService.SendVerificationEmail(req.Email, token)
```
This ensures the `users` table only contains verified identities.

### AI Prompt Engineering
The system uses a rigid JSON-mode prompt to ensure AI returns strictly parsable data.
```text
Return ONLY one JSON object:
{
  "vendor_name": "...",
  "amount": 0.00,
  "category": "Food|Travel|..."
}
```

### OCR & Image Processing
- **Contrast Lifting:** `(v-30) * 255.0 / 215.0` used to darken faint receipt text.
- **Multi-page Support:** Iterates through first 5 pages of a PDF to find the most relevant receipt data.

---

## 5. Tools & Libraries Summary

| Tool | Usage | Why? |
| :--- | :--- | :--- |
| **Fiber (Go)** | Backend Framework | Blazing fast, low memory footprint. |
| **pgx (Go)** | DB Driver | Direct PostgreSQL protocol support, high performance. |
| **TanStack Query** | Frontend State | Robust caching, refetching, and pagination. |
| **Zod / Joi** | Validation | Type-safety for incoming request bodies. |
| **NextAuth.js** | Auth Orchestration | Industry standard for Next.js auth flows. |
| **SMTP (net/smtp)** | Email | Raw SMTP for direct control over delivery. |

---

## 6. End-to-End Flow: Receipt Processing
1. User uploads `receipt.pdf` from the Dashboard.
2. `useUploadReceipt` hook sends a `multipart/form-data` request to `/receipts/upload`.
3. Backend saves the file and pushes a job to Redis.
4. Worker picks up the job, runs the `ExtractionPipeline`.
5. Gemini/OpenAI extracts data. Results saved to `receipts` table.
6. Frontend (polling via TanStack Query) detects `status="processed"` and updates the UI instantly.

---

**Personal Note:** This architecture is designed for "Enterprise Grade" scale—handling high concurrency with low latency and maximum reliability.

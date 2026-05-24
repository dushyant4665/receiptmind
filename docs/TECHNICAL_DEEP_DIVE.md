# ReceiptMind Technical Deep-Dive (Confidential)

## 1. System Architecture Overview
The ReceiptMind Enterprise platform is a high-performance document processing pipeline built using a decoupled architecture.

- **Frontend:** Next.js 16 (App Router), TypeScript, TailwindCSS, TanStack Query (v5), NextAuth.js.
- **Backend:** Node.js with Express, PostgreSQL.
- **AI/ML:** Gemini 1.5 Flash (Primary) & OpenAI GPT-4o (Fallback) for document extraction.
- **Database:** PostgreSQL via pg for relational data.

---

## 2. Backend Deep-Dive (Node.js & Express)

### Core Components:
- **Server Setup (`src/app.js`):** Uses Express with middleware including Security Headers, CORS, Rate Limiting, and Request Logging.
- **Database Layer (`src/config/db.js`):** Uses `pg` for efficient connection management. Schema-first design with complex indexes for receipt searching.
- **Auth Flow (Refactored):**
    - **Verify-then-Save:** Prevents DB pollution. Data is stored in `pending_registrations` until email verification.
    - **JWT Service:** Generates Access Tokens and Refresh Tokens (7-day expiry).
    - **Security:** bcryptjs for password hashing.

### Document Processing Pipeline (`src/services`):
1. **Upload:** Files are stored in Local Storage or S3.
2. **Immediate Processing:** No queue required - processing starts in background immediately.
3. **Pipeline Steps:**
    - **OCR:** Extracts raw text.
    - **AI Extraction:** `aiService.js` sends the image + OCR context to Gemini 1.5 Flash using high-density JSON prompts.
    - **Retry Logic:** If Gemini fails, it automatically falls back to OpenAI GPT-4o.
4. **Data Normalization:** Raw AI output is parsed into structured fields (Vendor, Amount, Date, Category) with confidence scores.

---

## 3. Frontend Deep-Dive (Next.js & TypeScript)

### State Management & Data Fetching:
- **TanStack Query:** Handles all server state. Implements polling (3s) for pending receipts to provide a "live" processing feel.
- **Axios Client:** Centrally managed in `lib/api-client.ts` with interceptors for JWT injection and 401 (Auto-Logout) handling.

### UI/UX Design System:
- **Styling:** Tailwind CSS. Uses a high-contrast monochromatic theme with "Amber" accents.
- **Components:** Modular React components (Shadcn/UI base) for Receipts Table, Dashboard Charts, and Exception Modals.
- **Responsive:** Fluid layout using CSS Variables for consistent spacing and typography.

---

## 4. Key Logic & Coding Concepts

### Verify-then-Save Signup Logic
Instead of creating a 'pending' user, we store data in `pending_registrations`.
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

---

## 5. Tools & Libraries Summary

| Tool | Usage | Why? |
| :--- | :--- | :--- |
| **Express (Node.js)** | Backend Framework | Minimal and flexible, large ecosystem. |
| **pg (Node.js)** | DB Driver | Direct PostgreSQL protocol support, high performance. |
| **TanStack Query** | Frontend State | Robust caching, refetching, and pagination. |
| **Zod** | Validation | Type-safety for incoming request bodies. |
| **NextAuth.js** | Auth Orchestration | Industry standard for Next.js auth flows. |
| **Nodemailer** | Email | Email sending with SMTP. |

---

## 6. End-to-End Flow: Receipt Processing
1. User uploads `receipt.pdf` from the Dashboard.
2. `useUploadReceipt` hook sends a `multipart/form-data` request to `/receipts/upload`.
3. Backend saves the file and starts background processing.
4. `receiptProcessingService.processReceipt` runs the extraction.
5. Gemini/OpenAI extracts data. Results saved to `receipts` table.
6. Frontend (polling via TanStack Query) detects `status="processed"` and updates the UI instantly.

---

**Personal Note:** This architecture is designed for ease of deployment and maintenance—no external dependencies like Redis required, just PostgreSQL.

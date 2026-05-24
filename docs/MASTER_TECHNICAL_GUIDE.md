# ReceiptMind: The Master Technical Guide (Full System Explanation)

This document is a comprehensive technical breakdown of the ReceiptMind Enterprise platform. It covers everything from high-level architecture to low-level coding patterns. Use this as your personal manual to master the concepts implemented in this codebase.

---

## 1. Backend Architecture: The Node.js & Express Powerhouse

### Why Node.js and Express?
The backend is built in **Node.js** using the **Express** framework.
- **Node.js:** Chosen for its non-blocking I/O and large ecosystem of packages.
- **Express:** Minimal and flexible web application framework that provides a robust set of features for web and mobile applications.

### Structural Pattern: Modular Design
We use a modular design pattern. Instead of using global variables, we organize code into separate modules (controllers, services, config, etc.).
- **Benefits:** Easier testing, better modularity, and clear separation of concerns.
- **Implementation:** Code is split into `config/`, `controllers/`, `services/`, `routes/`, and `middleware/`.

### Database Interaction: pg
We don't use a heavy ORM to maintain maximum performance. We use **pg**, a low-level PostgreSQL driver.
- **Connection Pooling:** `pg` allows multiple concurrent queries without opening new connections repeatedly.
- **Raw SQL:** We write optimized SQL queries, giving us full control over query plans and indexes.

---

## 2. Advanced Authentication: The "Verify-then-Save" Flow

### The Logic Breakdown
Most apps create a user with `status='pending'` upon signup. We changed this to a **Verify-then-Save** flow:
1. **Request:** User hits `/auth/register`.
2. **Temporary Storage:** Data is hashed and saved into `pending_registrations`. No entry is made in the main `users` table.
3. **Verification:** When the user clicks the email link, a **Transaction (TX)** starts:
   - Move data from `pending_registrations` to `users`.
   - Create the `organizations` record.
   - Delete the temporary record.
- **Why?** This prevents "Dead Accounts" in your main users table and ensures that every ID in the `users` table is a verified human.

### Security Implementation
- **Password Hashing:** Uses `bcryptjs`. It implements salting automatically to prevent rainbow table attacks.
- **JWT (JSON Web Tokens):** Uses `jsonwebtoken`. We implement a **Dual-Token System**:
  - **Access Token:** Short-lived (15 min), stored in memory/header.
  - **Refresh Token:** Long-lived (7 days), stored in the database for session revocation.

---

## 3. Frontend Architecture: Next.js 16 & TanStack Query

### The Modern Stack
- **Next.js 16 (App Router):** Uses Server Components for SEO and Client Components for interactivity.
- **TanStack Query (React Query):** This is the "brain" of our frontend state.
  - **Auto-Polling:** In `hooks/use-receipts.ts`, we use `refetchInterval: 3000` for receipts that are "processing". The UI updates automatically without a page refresh.
  - **Caching:** Prevents redundant API calls by keeping data "fresh" for a specific duration.

### API Orchestration
The `lib/api-client.ts` uses **Axios Interceptors**:
- **Request Interceptor:** Automatically attaches the `Bearer <token>` to every request.
- **Response Interceptor:** If the backend returns a `401 Unauthorized`, the interceptor triggers an automatic logout via `next-auth`.

---

## 4. AI & Document Processing Pipeline (The Core Feature)

### The Pipeline Flow (`receiptProcessingService.js`)
1. **File Detection:** Validates file types using mimetypes.
2. **OCR:** Uses Tesseract.js or similar to extract raw text.
3. **Multi-Stage AI Strategy:**
   - **Gemini 1.5 Flash:** Used as the primary engine because it's fast and supports a huge context window.
   - **OpenAI Fallback:** If Gemini hits a rate limit or fails, the system automatically switches to GPT-4o.

### AI Prompt Engineering
We use **JSON Mode**. The prompt tells the AI exactly what fields to return.
- **Confidence Scoring:** We ask the AI to rate its own work. If the confidence is below 0.75, the system marks the receipt as `needs_review`.

---

## 5. Reliability & Performance

### Immediate Background Processing
When a file is uploaded, we don't block the HTTP request.
1. The API returns "201 Created" immediately.
2. The receipt is processed in the background using Node.js's async capabilities.
3. The database is updated with extraction results.
- **Benefit:** The app stays fast even if the AI takes 10 seconds to respond.

### Transactional Integrity (ACID)
In the backend, we use database transactions. This ensures that if any part of a process fails, the whole thing is "rolled back" as if it never happened. No partial data is left behind.

---

## 6. CSS & Design System
- **Tailwind CSS:** We use Tailwind for layout (Flexbox/Grid) and styling.
- **Thematic Consistency:** The UI uses a clean, modern theme with `amber-500` for primary actions, creating a professional enterprise look.

---

## 7. Folder Structure Summary

| Path | Purpose |
| :--- | :--- |
| `backend/src/config` | Database and environment configuration |
| `backend/src/controllers` | Entry points for API requests (The "Controllers") |
| `backend/src/services` | The "Business Logic" (AI, Email, JWT, Receipt Processing) |
| `backend/src/middleware` | Authentication and other middleware |
| `backend/src/routes` | API route definitions |
| `frontend/app/(dashboard)` | Private routes protected by middleware |
| `frontend/hooks` | Custom React hooks for data fetching |
| `docs/` | PRD, TRS, and this Master Guide |

---

**Educational Goal:** Study the `upload` function in `receiptController.js` and the `processReceipt` method in `receiptProcessingService.js`. These two files contain the most advanced logic in the entire system.

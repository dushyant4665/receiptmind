# ReceiptMind: The Master Technical Guide (Full System Explanation)

This document is a comprehensive technical breakdown of the ReceiptMind Enterprise platform. It covers everything from high-level architecture to low-level coding patterns. Use this as your personal manual to master the concepts implemented in this codebase.

---

## 1. Backend Architecture: The Go (Fiber) Powerhouse

### Why Go and Fiber?
The backend is built in **Golang** using the **Fiber** framework.
- **Go:** Chosen for its native concurrency (Goroutines) and high-speed execution.
- **Fiber:** Inspired by Express (Node.js) but built on top of `fasthttp`, the fastest HTTP engine for Go. It uses a **zero-allocation** philosophy to minimize Garbage Collection (GC) pauses.

### Structural Pattern: Dependency Injection (DI)
We use a structured DI pattern in `internal/server/server.go`. Instead of using global variables, we pass dependencies (DB, Redis, Services) into structs.
- **Benefits:** Easier testing, better modularity, and explicit state management.
- **Implementation:** `New()` function initializes all services and injects them into the `Server` struct.

### Database Interaction: pgx (v5)
We don't use a heavy ORM (like Gorm) to maintain maximum performance. We use **pgx**, a low-level PostgreSQL driver.
- **Connection Pooling:** `pgxpool` allows multiple concurrent queries without opening new connections repeatedly.
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
- **Password Hashing:** Uses `golang.org/x/crypto/bcrypt`. It implements salting automatically to prevent rainbow table attacks.
- **JWT (JSON Web Tokens):** Uses `golang-jwt`. We implement a **Dual-Token System**:
  - **Access Token:** Short-lived (15 min), stored in memory/header.
  - **Refresh Token:** Long-lived (7 days), stored in the database for session revocation.

---

## 3. Frontend Architecture: Next.js 15 & TanStack Query

### The Modern Stack
- **Next.js 15 (App Router):** Uses Server Components for SEO and Client Components for interactivity.
- **TanStack Query (React Query):** This is the "brain" of our frontend state.
  - **Auto-Polling:** In `hooks/use-receipts.ts`, we use `refetchInterval: 3000` for receipts that are "processing". The UI updates automatically without a page refresh.
  - **Caching:** Prevents redundant API calls by keeping data "fresh" for a specific duration.

### API Orchestration
The `lib/api-client.ts` uses **Axios Interceptors**:
- **Request Interceptor:** Automatically attaches the `Bearer <token>` to every request.
- **Response Interceptor:** If the backend returns a `401 Unauthorized`, the interceptor triggers an automatic logout via `next-auth`.

---

## 4. AI & Document Processing Pipeline (The Core Feature)

### The Pipeline Flow (`extraction_pipeline.go`)
1. **File Detection:** Uses "Magic Numbers" (first few bytes of a file) to detect if it's a PDF or Image, rather than relying only on file extensions.
2. **Preprocessing (Image Enhancement):**
   - **Grayscale Conversion:** Reduces noise and file size.
   - **Contrast Lifting:** Mathematically darkens text and lightens the background to help the AI "see" better.
3. **Multi-Stage AI Strategy:**
   - **Gemini 1.5 Flash:** Used as the primary engine because it's fast and supports a huge context window.
   - **OpenAI Fallback:** If Gemini hits a rate limit or fails, the system automatically switches to GPT-4o.

### AI Prompt Engineering
We use **JSON Mode**. The prompt tells the AI exactly what fields to return.
- **Confidence Scoring:** We ask the AI to rate its own work. If the confidence is below 0.7, the system marks the receipt as `needs_review`.

---

## 5. Distributed Systems & Reliability

### Redis Worker Queue
When a file is uploaded, we don't process it in the HTTP request (that would be too slow).
1. The API returns "202 Accepted" immediately.
2. The job is pushed to **Redis**.
3. A separate **Worker Goroutine** picks up the job and starts the AI extraction.
- **Benefit:** The app stays fast even if the AI takes 10 seconds to respond.

### Transactional Integrity (ACID)
In the backend, we use `tx.Begin(ctx)`. This ensures that if any part of a process fails (e.g., creating a user succeeds but creating their organization fails), the whole thing is "rolled back" as if it never happened. No partial data is left behind.

---

## 6. CSS & Design System
- **Vanilla CSS + Tailwind:** We use Tailwind for layout (Flexbox/Grid) but use Vanilla CSS variables for the theme.
- **Thematic Consistency:** The UI uses a "Noir" theme (Black/White/Gray) with `amber-500` for primary actions, creating a professional enterprise look.

---

## 7. Folder Structure Summary

| Path | Purpose |
| :--- | :--- |
| `backend/internal/handlers` | Entry points for API requests (The "Controllers"). |
| `backend/internal/services` | The "Business Logic" (AI, Email, JWT). |
| `backend/internal/models` | Struct definitions for Database tables. |
| `frontend/app/(dashboard)` | Private routes protected by middleware. |
| `frontend/hooks` | Custom React hooks for data fetching. |
| `docs/` | PRD, TRS, and this Master Guide. |

---

**Educational Goal:** Study the `Register` handler in `auth_handler.go` and the `Process` method in `extraction_pipeline.go`. These two files contain the most advanced logic in the entire system.

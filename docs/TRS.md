# Technical Requirements Specification (TRS) - ReceiptMind

## 1. System Architecture

ReceiptMind follows a decoupled Microservices-lite architecture with a clear separation between the UI and the Backend.

### 1.1 Technology Stack
- **Frontend:** Next.js 15+ (App Router), TypeScript, React 19.
- **Backend:** Go 1.22+, Fiber v2 (HTTP Framework).
- **Database:** PostgreSQL (Primary), Redis (Queuing & Caching).
- **Storage:** Supabase Storage (S3-compatible).
- **AI:** Google Gemini 1.5 Flash (Primary), OpenAI GPT-4o (Fallback).
- **Auth:** NextAuth.js (Frontend), JWT (Backend).

## 2. Backend Specifications

### 2.1 API Design
- **RESTful API:** JSON-based communication.
- **Routing:** Fiber's group-based routing for versioning (`/api/v1`).
- **Middleware:** 
  - `AuthMiddleware`: JWT verification and user context injection.
  - `LoggerMiddleware`: Structured logging with Zerolog.
  - `RecoverMiddleware`: Prevents server crashes on panics.

### 2.2 Concurrency & Background Processing
- **Worker Pattern:** Go's goroutines are used to process extraction jobs asynchronously.
- **Task Queue:** Redis-backed queue ensures durability and scalability.
- **Idempotency:** File hashing prevents duplicate processing of the same document.

### 2.3 Database Schema (Canonical Model)
- **Organizations:** Multi-tenant root entity.
- **Users:** Belong to organizations.
- **Receipts:** Core entity linked to organizations and users.
- **Rules:** Conditional logic for auto-categorization.
- **Exceptions:** Records requiring manual intervention.

## 3. Frontend Specifications

### 3.1 State Management
- **Server State:** TanStack React Query for caching, optimistic updates, and background revalidation.
- **Client State:** React `useState` and `useContext` for UI-only state (modals, filters).

### 3.2 UI Components
- **Framework:** Tailwind CSS for utility-first styling.
- **Components:** Radix UI primitives for accessible UI (Dialogs, Dropdowns, Tabs).
- **Icons:** Lucide-React.

### 3.3 API Integration
- **Client:** Axios instance with global interceptors.
- **Auth Injection:** Automatically attaches JWT tokens from the NextAuth session.

## 4. Security & Compliance
- **Data Isolation:** Every database query is scoped by `organization_id`.
- **JWT Security:** HS256 signed tokens with short expiration.
- **Input Validation:** Strict type checking in Go and TypeScript.
- **Storage Security:** Private buckets with Signed URLs for document access.

## 5. Deployment & DevOps
- **Backend:** Scalable Go binary (Dockerized).
- **Frontend:** Vercel or similar Edge-ready platform.
- **CI/CD:** Automated testing (Go tests, Playwright for E2E).
- **Monitoring:** Sentry for error tracking, Zerolog for structured backend logs.

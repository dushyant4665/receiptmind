# Technical Requirements Specification (TRS) - ReceiptMind

## 1. System Architecture

ReceiptMind follows a decoupled architecture with a clear separation between the UI and the Backend.

### 1.1 Technology Stack
- **Frontend:** Next.js 16+ (App Router), TypeScript, React 19.
- **Backend:** Node.js 18+, Express.js.
- **Database:** PostgreSQL (Primary).
- **Storage:** Local or S3-compatible storage.
- **AI:** Google Gemini 1.5 Flash (Primary), OpenAI GPT-4o (Fallback).
- **Auth:** NextAuth.js (Frontend), JWT (Backend).

## 2. Backend Specifications

### 2.1 API Design
- **RESTful API:** JSON-based communication.
- **Routing:** Express router-based routing.
- **Middleware:** 
  - `auth.js`: JWT verification and user context injection.
  - `morgan`: HTTP request logging.
  - `helmet`: Security headers.
  - `cors`: Cross-origin resource sharing.

### 2.2 Background Processing
- **Immediate Processing:** No queue required - processing starts in background immediately using Node.js async capabilities.
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
- **Input Validation:** Strict type checking in TypeScript.
- **Storage Security:** Private buckets with Signed URLs for document access.

## 5. Deployment & DevOps
- **Backend:** Render Web Service (Node.js).
- **Frontend:** Vercel or similar Edge-ready platform.
- **Monitoring:** Sentry for error tracking.

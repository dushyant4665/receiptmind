# ReceiptMind System Flow

This document describes the end-to-end flow of data and actions within the ReceiptMind platform.

## 1. Receipt Upload & Processing Flow

The core feature of ReceiptMind is the AI-powered extraction of data from uploaded receipts.

```mermaid
sequenceDiagram
    participant User
    participant Frontend (Next.js)
    participant Backend (Express)
    participant Storage (Local/S3)
    participant AI (Gemini/OpenAI)
    participant DB (PostgreSQL)

    User->>Frontend: Select & Upload File
    Frontend->>Backend: POST /receipts/upload (Multipart)
    Backend->>Backend: Validate Type/Size
    Backend->>Storage: Upload Binary
    Storage-->>Backend: File Path
    Backend->>DB: INSERT Receipt (status: processing)
    Backend->>Backend: Start Background Processing
    Backend-->>Frontend: 201 Created (ID, processing status)
    Frontend-->>User: Show "Processing..." in UI

    Note over Backend, AI: Async Processing
    Backend->>Storage: Fetch File Data
    Backend->>AI: Send Image for Extraction
    AI-->>Backend: Structured JSON (Vendor, Amount, etc.)
    Backend->>DB: UPDATE Receipt (Extracted Data, status: processed)

    Note over Frontend, DB: Real-time Update (Polling)
    Frontend->>Backend: GET /receipts (via React Query)
    Backend->>DB: SELECT Receipts
    DB-->>Backend: Updated Data
    Backend-->>Frontend: 200 OK (with extracted data)
    Frontend-->>User: Update UI with Vendor & Amount
```

### Step-by-Step Breakdown:

1.  **Frontend Interaction:** The user interacts with `UploadDropzone.tsx`. The file is sent to the backend using the `uploadApiData` helper in `api-client.ts`.
2.  **Synchronous Backend Handling:**
    *   `receiptController.upload` validates the file.
    *   The file is stored in storage via `storageService`.
    *   A database record is created immediately with `status: processing`.
    *   Background processing is initiated.
    *   The user gets an immediate response, keeping the UI responsive.
3.  **Asynchronous Background Processing:**
    *   `receiptProcessingService.processReceipt` handles the extraction.
    *   It uses `aiService` to communicate with Gemini (primary).
    *   The AI "sees" the receipt image and returns structured JSON.
    *   The database is updated with the extracted fields (vendor name, total amount, date, category).
4.  **UI Synchronization:**
    *   The frontend uses TanStack React Query (`useReceipts` hook).
    *   It polls or revalidates the data, seeing the status change from `processing` to `processed`.
    *   Toast notifications inform the user when the extraction is finished.

---

## 2. Authentication Flow

ReceiptMind uses JWT-based authentication integrated with NextAuth.

1.  **Direct Registration:** User submits details to `/auth/register`. The organization and user are created immediately.
2.  **Token Generation:** Backend verifies credentials and returns an `access_token` (short-lived) and `refresh_token` (long-lived).
3.  **Session Management:** NextAuth stores these tokens in a secure cookie.
4.  **Authorized Requests:**
    *   `api-client.ts` uses an Axios interceptor to attach the `Authorization: Bearer <token>` header to every request.
    *   Backend `authMiddleware` verifies the JWT and injects `user_id` and `organization_id` into the request.
5.  **Token Expiry:** If a request returns `401 Unauthorized`, the frontend interceptor triggers a sign-out flow.

---

## 3. Categorization & Rules Flow

1.  **Manual Edit:** User edits a receipt's category.
2.  **Auto-Learning:** If "Create rule after save" is checked, the frontend calls `POST /rules`.
3.  **Rule Application:**
    *   Future uploads are matched against existing rules in `ruleService`.
    *   If a vendor matches, the category is applied automatically during processing.

---

## 4. Exception Handling Flow

1.  **Detection:** During AI extraction, if `confidence < 0.75` or fields are missing, the `exceptionService` creates an exception record linked to the receipt.
2.  **User Review:** The "Exceptions" page in the dashboard lists these receipts.
3.  **Resolution:** User corrects the data, which updates the receipt and marks the exception as `resolved`.

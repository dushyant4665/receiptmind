# Receipt Processing Flow

This page shows the real backend flow from upload to final receipt state.

## End-to-End Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Storage
    participant AI
    participant DB

    User->>Frontend: Choose file and submit upload
    Frontend->>Backend: POST /api/receipts/upload
    Backend->>Storage: Save file
    Backend->>DB: Create receipt + processing job
    Backend-->>Frontend: Return receipt id
    Backend->>AI: Try OpenRouter first
    alt OpenRouter succeeds
        AI-->>Backend: Structured JSON
    else OpenRouter fails
        Backend->>AI: Retry with Gemini
        alt Gemini succeeds
            AI-->>Backend: Structured JSON
        else Gemini fails
            Backend->>Backend: Run Tesseract OCR fallback
        end
    end
    Backend->>Backend: Validate, normalize, apply rules
    Backend->>DB: Update receipt state
    Frontend->>Backend: Poll receipt details
    Backend-->>Frontend: processed / needs_review / failed
```

## State Model

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> processing
    processing --> processed
    processing --> needs_review
    processing --> failed
    needs_review --> processed: manual correction
```

## High-Level Modules

- `receiptController`: upload and receipt-facing HTTP endpoints
- `authController`: registration, verification, password reset, and session flows
- `emailService`: Brevo API integration for verification and password reset email
- `receiptProcessingService`: queue orchestration and status transitions
- `aiService`: provider selection and extraction fallback chain
- `validationService`: field cleanup, normalization, confidence handling
- `ruleService`: business rule application
- `exceptionService`: review issue creation
- `fileController`: signed file preview endpoint
- `exportController`: CSV export and export history
- `storageService`: file save and file read operations

## Failure Boundaries

- Upload failure: request never creates a receipt record
- Email provider failure: pending registration or reset token still exists, but the response reports `email_sent: false`
- Extraction failure: receipt is stored but marked `failed`
- Low-confidence extraction: receipt moves to `needs_review`
- Provider outage: system falls through to the next extraction layer

## Operational Summary

- Storage is synchronous at upload time.
- Extraction is asynchronous after the initial acknowledgement.
- Frontend status updates are polling-based.
- CSV export is independent of receipt extraction and reads persisted data from the database.
- Verification and reset emails use Brevo's HTTPS API from the backend. On Render, Brevo may require the service outbound IP to be added under Security -> Authorised IPs.

# Receipt Processing Flow

This document explains the high-level flow of the live system from upload to final review state.

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
    Backend->>AI: Attempt extraction
    alt OpenRouter succeeds
        AI-->>Backend: Structured JSON
    else OpenRouter fails
        Backend->>AI: Retry through Gemini
        alt Gemini succeeds
            AI-->>Backend: Structured JSON
        else Gemini fails
            Backend->>Backend: Run Tesseract OCR fallback
        end
    end
    Backend->>Backend: Validate and normalize fields
    Backend->>Backend: Apply rules and exception checks
    Backend->>DB: Update final receipt state
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
- `receiptProcessingService`: queue orchestration and status transitions
- `aiService`: provider selection and extraction fallback chain
- `validationService`: field cleanup, normalization, confidence handling
- `ruleService`: business rule application
- `exceptionService`: review issue creation
- `storageService`: file save and file read operations

## Failure Boundaries

- Upload failure: request never creates a receipt record
- Extraction failure: receipt is stored but marked `failed`
- Low-confidence extraction: receipt moves to `needs_review`
- Provider outage: system falls through to the next extraction layer

## Operational Summary

- Storage is synchronous at upload time.
- Extraction is asynchronous after the initial acknowledgement.
- Frontend status updates are polling-based.
- CSV export is independent of receipt extraction and reads persisted data from the database.

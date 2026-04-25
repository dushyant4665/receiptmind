# ReceiptMind Build Roadmap

This repo now contains the database foundation for the full ReceiptMind product vision:

- document ingestion
- AI extraction
- bank matching
- rule-based categorization
- accounting sync
- exception routing
- team approvals
- accountant sharing
- billing and plan enforcement

## Core Loop

1. Upload receipt, invoice, or inbound email attachment
2. Store file in Supabase Storage
3. Create `receipts` row with `status='pending'`
4. Queue extraction worker / edge function
5. Call GPT-4o vision and normalize output
6. Apply category rules
7. Attempt duplicate detection
8. Attempt bank transaction match
9. Route low-confidence items into `exceptions`
10. Allow approval / posting to QBO or Xero

## Suggested Implementation Order

### Phase 1

- Supabase auth + profile trigger
- receipt upload endpoint
- GPT-4o extraction worker
- dashboard receipts list
- exception inbox

### Phase 2

- category rules CRUD
- editable receipt detail panel
- duplicate detection
- free-plan enforcement middleware
- CSV export

### Phase 3

- QBO + Xero OAuth
- Gmail + inbound email ingestion
- Stripe billing
- team invites and approvals

### Phase 4

- Plaid transaction sync
- automatic receipt matching
- multi-client firm mode
- accountant share links

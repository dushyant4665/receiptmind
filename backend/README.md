# ReceiptMind Node.js Backend

Migrated from Go to Node.js (Express).

## Features
- Full Authentication (Register, Login, Email Verification, Password Reset)
- Receipt Management (Upload, List, Edit, Delete, Bulk Export)
- AI-powered Extraction (Gemini 1.5 Flash / OpenAI)
- Rule Engine & Exception Tracking
- Dashboard Statistics
- Redis Caching
- Background Processing (BullMQ)

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Cache & Queue:** Redis
- **AI:** Google Gemini / OpenAI
- **Mailer:** Nodemailer (SMTP)

## Project Structure
```
src/
├── config/      # DB, Redis configuration
├── controllers/ # Request handlers
├── middleware/  # Auth and other middlewares
├── routes/      # API routes
├── services/    # Business logic (AI, Email, Storage, JWT)
├── workers/     # Background job processors
├── app.js       # Express app setup
└── index.js     # Entry point
```

## Setup
1. `npm install`
2. Configure `.env` file
3. `npm start` or `npm run dev`

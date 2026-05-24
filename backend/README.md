# ReceiptMind Node.js Backend

## Features
- Full Authentication (Register, Login, Email Verification, Password Reset)
- Receipt Management (Upload, List, Edit, Delete, Bulk Export)
- AI-powered Extraction (Gemini 1.5 Flash / OpenAI)
- Rule Engine & Exception Tracking
- Dashboard Statistics
- Immediate Background Processing (no queue required)

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **AI:** Google Gemini / OpenAI
- **Mailer:** Nodemailer (SMTP)

## Project Structure
```
src/
├── config/      # DB configuration
├── controllers/ # Request handlers
├── middleware/  # Auth and other middlewares
├── routes/      # API routes
├── services/    # Business logic (AI, Email, Storage, JWT, Receipt Processing)
├── app.js       # Express app setup
└── index.js     # Entry point
```

## Setup
1. `npm install`
2. Configure `.env` file
3. `npm start` or `npm run dev`

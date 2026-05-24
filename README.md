# ReceiptMind Enterprise

ReceiptMind is an intelligent expense automation and document extraction platform designed for finance teams, operations, and modern enterprises. By combining advanced AI models with reliable background processing, it eliminates manual data entry, guarantees high extraction accuracy through exception handling, and automates organizational workflows.

## Architecture

The platform is built as a decoupled, multi-tenant application designed for performance, resilience, and horizontal scaling.

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#333
    classDef backend fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0284c7
    classDef database fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#db2777
    classDef queue fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#d97706
    classDef ai fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#7c3aed

    %% Nodes
    Client["Next.js Frontend\n(App Router, Tailwind)"]:::client
    API["Node.js Backend\n(Express API)"]:::backend
    Worker["Background Worker\n(Node.js Bull)"]:::backend
    DB[(PostgreSQL)]:::database
    Redis[(Redis Queue)]:::queue
    Storage[("File Storage\n(Local/S3)")]:::database
    AI["Gemini / OpenRouter\n(LLM API)"]:::ai

    %% Edges
    Client -- "REST API (JWT)" --> API
    API -- "CRUD / Auth" --> DB
    API -- "Enqueue Job" --> Redis
    API -- "Save File" --> Storage
    Worker -- "Dequeue Job" --> Redis
    Worker -- "Read File" --> Storage
    Worker -- "Extract Data" --> AI
    Worker -- "Update Status" --> DB
```

### Component Details

- **Frontend**: A Next.js 14 application utilising the App Router, Tailwind CSS, and React Query. The user interface prioritises minimal visual noise, fast page transitions, and structured datagrids for high-throughput expense management.
- **Backend API**: A Node.js and Express REST API that handles authentication, multi-tenant scoping, receipt ingestion, rules management, and administrative operations.
- **Queue and Background Worker**: Redis and Bull queue-based asynchronous processing. The API server accepts files instantly, delegates heavy document parsing and LLM calls to background processes, and updates database records in real-time.
- **Relational Storage**: PostgreSQL acts as the core database, storing relational structures for organizations, users, receipts, rules, and exception logs.

## Core Capabilities

- **AI Extraction Engine**: Extracts complex transactional schemas from raw images or PDFs using Google Gemini. The engine normalizes vendor names, amounts, tax details, GSTIN identifiers, currency codes, invoice numbers, and due dates.
- **Exceptions Inbox**: Receipts with extraction confidence below 75% or those missing critical compliance fields are flagged. They are routed to a human review queue, allowing operators to easily audit and correct entries.
- **Custom Rules Engine**: Allows organizations to build conditional criteria (such as vendor matches) that automatically assign categories, departments, or custom labels to receipts on ingestion.
- **Dual-Token JWT Authentication**: Uses short-lived access tokens and secure, database-verified, HTTP-only refresh tokens to manage persistent sessions safely.
- **Duplicate Prevention**: Computes cryptographic SHA-256 hashes of incoming payloads to identify and block duplicate receipts before database entry.
- **Data Portability**: Full search, date, and status filter criteria with an immediate CSV export builder.

## Local Development

### Prerequisites

You need PostgreSQL, Redis, and Node.js (version 18 or above) installed on your machine.

### Setup Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/dushyant4665/receiptmind.git
   cd receiptmind-enterprise
   ```

2. **Database Settings**
   Configure your PostgreSQL and Redis connections. Ensure your target PostgreSQL database is created.

3. **Backend Configuration**
   Navigate to the backend directory, copy `.env.example` to `.env`, and fill in the required variables (including your database credentials and Gemini API key).
   ```bash
   cd backend
   npm install
   # Run migrations
   node scripts/migrate_db.js
   # Start in development mode
   npm run dev
   ```

4. **Frontend Configuration**
   Navigate to the frontend directory, copy `.env.example` to `.env.local`, and point the API URL to your local backend.
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## Docker Deployment

To spin up the entire system locally inside containerized environments:

1. Configure your environment variables in `docker-compose.yml` or within your environment context.
2. Run the compose file:
   ```bash
   docker-compose up -d --build
   ```

## Production Deployment

### Backend (Render)

The backend service is container-ready and designed to deploy on Render as a Web Service.

1. **New Web Service**: Connect your GitHub repository to Render.
2. **Build Configuration**:
   - Environment: Docker
   - Dockerfile Path: `backend/Dockerfile`
3. **Environment Variables**: Add your production values for:
   - `DATABASE_URL` (PostgreSQL)
   - `REDIS_URL` (Redis instance)
   - `JWT_SECRET`
   - `GEMINI_API_KEY`
4. **Health Check**: Configure `/health` as the monitoring endpoint.

### Frontend (Vercel)

The Next.js frontend is optimized for serverless hosting on Vercel.

1. **Import Project**: Import the repository into the Vercel dashboard.
2. **Project Settings**:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
3. **Environment Variables**:
   - Set `NEXT_PUBLIC_API_URL` to your production Render backend URL.
4. **Deploy**: Click deploy. Vercel automatically builds, checks TypeScript types, and serves your client-side routes.

# Technical Deep Dive

This page is for people who want to know the deep secrets of how ReceiptMind works.

## 1. Authentication (Logging In)

We use a special system for signing up. Instead of creating a user account immediately, we save the information in a temporary table called `pending_registrations`. 

The user then gets an email with a link. When they click it, the system moves their information into the main `users` table and creates their `organization`. This ensures that every user in our system has a real, working email address.

## 2. Background Processing

When you upload a receipt, the server doesn't wait for the AI to finish reading it. This is important because the AI can sometimes be slow. 

Instead, the server saves the file and immediately says "Done!" to the website. Then, it starts a background task. This task sends the file to the AI, waits for the answer, and then updates the database. Because it happens in the background, you can keep using the website without any lag.

## 3. Data Integrity (ACID)

We use database "Transactions" for important tasks like verifying an email or deleting a user. A transaction is like a promise: either everything in the task succeeds, or none of it happens. This prevents the database from getting half-finished or broken data.

## 4. Frontend State Management

We use a tool called "React Query" (or TanStack Query) to manage the data on the website. 

- **Automatic Syncing:** It automatically refreshes the data when you switch tabs or come back to the site.
- **Cache:** It saves a copy of the data so the website feels faster.
- **Polling:** For receipts that are still being processed, the website "polls" (asks repeatedly) the server every 3 seconds until the work is finished.

## 5. Security Details

- **JWT Tokens:** We use two tokens. An "Access Token" for everyday tasks (it lasts 15 minutes) and a "Refresh Token" to get a new access token (it lasts 7 days).
- **Environment Variables:** All secret information, like API keys and database passwords, is kept in a `.env` file and is never shared in the code itself.

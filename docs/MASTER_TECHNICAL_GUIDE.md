# Master Technical Guide

This guide explains how the code for ReceiptMind is organized. It is for anyone who wants to understand the technical details.

## 1. The Backend (The Server)

The server is built with Node.js and Express. It is the "brain" that handles data and talks to the AI.

### Folders:
- **config/**: This has the database connection settings.
- **controllers/**: These files handle the requests from the website. For example, `receiptController.js` handles uploading and deleting receipts.
- **services/**: This is where the real work happens.
  - `aiService.js`: Talks to the AI to read receipts.
  - `receiptProcessingService.js`: Manages the steps of reading a receipt.
  - `storageService.js`: Handles saving and deleting files on the computer.
  - `validationService.js`: Cleans up the data and makes sure it follows the right format.
- **routes/**: Tells the server which controller to use for each web address (like `/receipts` or `/auth`).
- **db/**: Contains the "migrations" which are the instructions for creating the database tables.

## 2. The Frontend (The Website)

 The website is built with Next.js and React. It is what the user sees and interacts with.

### Key Parts:
- **app/**: The main pages of the website, like the Dashboard and the Receipts list.
- **components/**: Small pieces of the website that are used in multiple places, like buttons or tables.
- **hooks/**: Special functions that fetch data from the server. For example, `useReceipts.ts` gets the list of receipts from the backend.
- **lib/**: Basic tools, like the `api-client.ts` which is used for all communication with the server.

## 3. The Database

We use a database called PostgreSQL to store all the information.

- **Multi-Tenant:** The system is built so that one company's data is never mixed up with another's. We do this by giving every organization its own unique ID.
- **Relationships:** Users belong to Organizations. Receipts belong to both a User and an Organization. This keeps everything organized.

## 4. How the AI Works

The most important part of the app is how the AI reads receipts.

1. **The Prompt:** We send a very specific set of instructions to the AI. We tell it exactly what fields to look for (Vendor, Amount, Date).
2. **Fallback:** If our main AI (Gemini) is not working, the system automatically tries to use another AI or a basic OCR tool.
3. **Confidence:** The AI tells us how sure it is about what it read. If the confidence is low, we ask the user to double-check the information.

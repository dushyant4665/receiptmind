# Technical Requirements Specification (TRS)

This document explains the technical parts of ReceiptMind. It describes the tools we used and how the system is put together.

## 1. The Technology Stack

### Frontend (The Website)
- Next.js 16: This is the main framework for building the website.
- React: Used for building the interactive parts of the UI.
- Tailwind CSS: Used for styling the website to make it look nice.
- Lucide React: Used for the icons.

### Backend (The Server)
- Node.js: The environment that runs our server code.
- Express: The framework that handles web requests and routes.
- Multer: A tool that helps us handle file uploads.
- Sharp: A tool used to process and resize images.

### Database (The Memory)
- PostgreSQL: This is where we save all the information about users, organizations, and receipts.
- PG (node-postgres): The tool the server uses to talk to the database.

### AI (The Brain)
- Google Gemini 1.5 Flash: The primary AI that reads the receipts.
- OpenRouter: A backup system that lets us use other AI models if Gemini is busy.

## 2. How the System is Organized

### The Database
- Organizations: Every user belongs to an organization. This keeps data separate.
- Users: People who sign up to use the app.
- Receipts: The core data, including file paths and the information found by AI.
- Rules: Custom settings created by users to help categorize receipts.

### Security
- Passwords: We never save plain passwords. We use "bcrypt" to turn them into a secret code.
- JWT: We use JSON Web Tokens to keep users logged in safely.
- Data Separation: The server always checks that a user only sees receipts belonging to their own organization.

## 3. How We Process Files
- Files are saved on the server's hard drive in an "uploads" folder.
- When a file is uploaded, the server gives it a unique name so files don't get mixed up.
- The AI runs in the background. This means the user doesn't have to wait for the AI to finish before they can do other things on the website.

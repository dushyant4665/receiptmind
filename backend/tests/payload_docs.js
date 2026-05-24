/**
 * Verification Script for ReceiptMind API
 * This script documents the expected payloads and headers for all main endpoints.
 */

const BASE_URL = 'http://localhost:3001/api';

const HEADERS = {
  'Content-Type': 'application/json',
};

const AUTH_HEADER = (token) => ({
  'Authorization': `Bearer ${token}`,
  ...HEADERS,
});

// 1. Auth: Register
const registerPayload = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
  organization_name: 'Test Org'
};

// 2. Auth: Login
const loginPayload = {
  email: 'test@example.com',
  password: 'SecurePassword123!'
};

// 3. Receipt: Upload (Multipart/Form-Data)
// Use FormData in JS or just -F in curl
// curl -X POST -H "Authorization: Bearer <token>" -F "file=@receipt.jpg" http://localhost:3001/api/receipts/upload

// 4. Receipt: List
// GET http://localhost:3001/api/receipts?limit=10&offset=0&status=processed

// 5. Receipt: Edit
const editPayload = {
  vendor_name: 'Updated Vendor',
  amount: 45.99,
  category: 'Food'
};

// 6. Rules: Create
const rulePayload = {
  condition_type: 'vendor',
  condition_value: 'Starbucks',
  action_type: 'category',
  action_value: 'Food'
};

console.log('API verification documentation created.');

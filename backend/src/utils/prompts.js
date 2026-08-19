// Prompt used by AI to extract structured receipt data
const buildReceiptPrompt = (ocrText = '') => `
You are an expert receipt & invoice data extraction engine.
Analyze the image (and optional OCR text) and return a STRICT JSON object only.

Rules:
- amount: Final total payable amount (number). Do not confuse subtotal with total.
- subtotal: Subtotal before taxes if visible (number or 0).
- tax_amount: Total tax/VAT/GST amount if visible (number or 0).
- vendor_name: Store/Company name only, without address.
- receipt_date: Date in YYYY-MM-DD format (or current date if not visible).
- currency: ISO 3-letter currency code (e.g. USD, EUR, INR, GBP).
- category: Standard expense category (e.g. Meals, Travel, Office Supplies, Software, Utilities, General).
- invoice_number: Invoice / receipt reference number if visible (string or empty).
- payment_method: Payment method like Cash, Visa, Mastercard, UPI, Amex (string or empty).
- confidence: Extraction confidence score between 0.0 and 1.0.

JSON FORMAT:
{
  "vendor_name": "",
  "amount": 0,
  "subtotal": 0,
  "tax_amount": 0,
  "receipt_date": "",
  "currency": "USD",
  "category": "General",
  "invoice_number": "",
  "payment_method": "",
  "confidence": 0.9
}

${ocrText ? `OCR CONTEXT:\n${ocrText}` : ''}
`;

module.exports = {
  buildReceiptPrompt,
};
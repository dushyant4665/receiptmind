const buildReceiptPrompt = (ocrText = '') => `
You are an enterprise-grade AI receipt extraction engine.

Analyze the uploaded receipt/invoice image carefully.

Return ONLY valid JSON.

STRICT RULES:

- amount = FINAL payable amount
- do NOT confuse subtotal with total
- vendor_name should contain ONLY company/shop name
- vendor_name must NOT contain address
- dates MUST be YYYY-MM-DD
- confidence MUST be between 0 and 1
- if uncertain use null
- currency should be ISO code like INR, USD, EUR
- category should be simple business category
- extract invoice_number if visible
- payment_method if available
- use OCR text as primary context
- image used as secondary verification

VALID JSON FORMAT:

{
  "vendor_name": "",
  "amount": 0,
  "subtotal": 0,
  "tax_amount": 0,
  "receipt_date": "",
  "currency": "",
  "category": "",
  "invoice_number": "",
  "payment_method": "",
  "confidence": 0
}

OCR TEXT:
${ocrText}
`;

module.exports = {
  buildReceiptPrompt,
};
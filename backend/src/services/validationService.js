const DEFAULT_CATEGORY = 'General';

/**
 * Cleans up text by removing extra spaces and tabs.
 */
const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

/**
 * Ensures money values are numbers with 2 decimal places.
 */
const normalizeMoney = (value) => {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }
  return 0;
};

/**
 * Ensures confidence is a number between 0 and 1.
 */
const normalizeConfidence = (value) => {
  let numeric = 0;
  if (typeof value === 'number') {
    numeric = value;
  } else {
    numeric = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  }

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 1 && numeric <= 100) return Number((numeric / 100).toFixed(2));
  return Math.min(1, Number(numeric.toFixed(2)));
};

/**
 * Formats dates into YYYY-MM-DD format.
 */
const normalizeDate = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  
  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parts = text.split(/[\/\-.]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) return '';

  // Handle YYYY-MM-DD or YYYY-DD-MM
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // Handle DD-MM-YYYY or MM-DD-YYYY
  if (parts[2].length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return '';

    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${parts[2]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return '';
};

/**
 * Validates the data extracted from a receipt.
 * It cleans the fields and checks if anything important is missing.
 */
const validateExtraction = (extraction) => {
  const sanitized = {
    ...extraction,
    vendor_name: cleanText(extraction.vendor_name),
    invoice_number: cleanText(extraction.invoice_number),
    invoice_date: normalizeDate(extraction.invoice_date),
    receipt_date: normalizeDate(extraction.receipt_date || extraction.invoice_date),
    due_date: normalizeDate(extraction.due_date),
    vendor_gstin: cleanText(extraction.vendor_gstin),
    buyer_name: cleanText(extraction.buyer_name),
    buyer_gstin: cleanText(extraction.buyer_gstin),
    payment_terms: cleanText(extraction.payment_terms),
    po_number: cleanText(extraction.po_number),
    category: cleanText(extraction.category) || DEFAULT_CATEGORY,
    currency: cleanText(extraction.currency).toUpperCase() || 'USD',
    amount: normalizeMoney(extraction.amount),
    subtotal: normalizeMoney(extraction.subtotal),
    tax_amount: normalizeMoney(extraction.tax_amount),
    confidence: normalizeConfidence(extraction.confidence),
    raw_text: typeof extraction.raw_text === 'string' ? extraction.raw_text.trim() : '',
  };

  // If amount is missing but we have subtotal and tax, calculate it.
  if (!sanitized.amount && sanitized.subtotal && sanitized.tax_amount) {
    sanitized.amount = normalizeMoney(sanitized.subtotal + sanitized.tax_amount);
  }

  // If subtotal is missing but we have amount and tax, calculate it.
  if (!sanitized.subtotal && sanitized.amount && sanitized.tax_amount && sanitized.amount >= sanitized.tax_amount) {
    sanitized.subtotal = normalizeMoney(sanitized.amount - sanitized.tax_amount);
  }

  // If AI didn't provide confidence, give a basic score based on found fields.
  if (!sanitized.confidence) {
    const hasVendor = !!sanitized.vendor_name;
    const hasAmount = sanitized.amount > 0;
    const hasDate = !!sanitized.receipt_date;
    
    const score = [hasVendor, hasAmount, hasDate].filter(Boolean).length;
    sanitized.confidence = score === 3 ? 0.9 : score === 2 ? 0.76 : score === 1 ? 0.58 : 0.2;
  }

  const missingFields = [];
  if (!sanitized.vendor_name) missingFields.push('vendor_name');
  if (!(sanitized.amount > 0)) missingFields.push('amount');
  if (!sanitized.receipt_date) missingFields.push('receipt_date');

  return {
    sanitized,
    missingFields,
    needsReview: sanitized.confidence < 0.9 || missingFields.length > 0,
  };
};

module.exports = {
  cleanText,
  normalizeMoney,
  normalizeConfidence,
  normalizeDate,
  validateExtraction,
};

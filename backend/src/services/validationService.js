const DEFAULT_CATEGORY = 'General';

const validateExtraction = (extraction) => {
  const sanitized = {
    ...extraction,
    vendor_name: cleanText(extraction.vendor_name) || '',
    invoice_number: cleanText(extraction.invoice_number) || '',
    invoice_date: normalizeDate(extraction.invoice_date),
    receipt_date: normalizeDate(extraction.receipt_date || extraction.invoice_date),
    due_date: normalizeDate(extraction.due_date),
    vendor_gstin: cleanText(extraction.vendor_gstin) || '',
    buyer_name: cleanText(extraction.buyer_name) || '',
    buyer_gstin: cleanText(extraction.buyer_gstin) || '',
    payment_terms: cleanText(extraction.payment_terms) || '',
    po_number: cleanText(extraction.po_number) || '',
    category: cleanText(extraction.category) || DEFAULT_CATEGORY,
    currency: cleanText(extraction.currency).toUpperCase() || 'USD',
    amount: normalizeMoney(extraction.amount),
    subtotal: normalizeMoney(extraction.subtotal),
    tax_amount: normalizeMoney(extraction.tax_amount),
    confidence: normalizeConfidence(extraction.confidence),
    raw_text: typeof extraction.raw_text === 'string' ? extraction.raw_text.trim() : '',
  };

  if (!sanitized.amount && sanitized.subtotal && sanitized.tax_amount) {
    sanitized.amount = normalizeMoney(sanitized.subtotal + sanitized.tax_amount);
  }

  if (!sanitized.subtotal && sanitized.amount && sanitized.tax_amount && sanitized.amount >= sanitized.tax_amount) {
    sanitized.subtotal = normalizeMoney(sanitized.amount - sanitized.tax_amount);
  }

  if (!sanitized.confidence) {
    const score = [sanitized.vendor_name, sanitized.amount > 0, sanitized.receipt_date].filter(Boolean).length;
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

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const normalizeMoney = (value) => {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }
  return 0;
};

const normalizeConfidence = (value) => {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 1 && numeric <= 100) return Number((numeric / 100).toFixed(2));
  return Math.min(1, Number(numeric.toFixed(2)));
};

const normalizeDate = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parts = text.split(/[\/\-.]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) return '';

  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

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

module.exports = {
  validateExtraction,
};

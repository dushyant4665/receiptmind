// Normalizes dates to YYYY-MM-DD format
const normalizeDate = (value) => {
  if (!value) return null;
  const str = String(value).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const parts = str.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;

  let year, month, day;
  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else {
    [day, month, year] = parts;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Normalizes currency strings into clean numbers
const normalizeAmount = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  // Remove currency symbols, commas, and whitespace
  const cleaned = String(value)
    .replace(/[₹€£$\s]/g, '')
    .replace(/,/g, '')
    .trim();

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Normalizes vendor strings (collapses multi-spaces)
const normalizeVendor = (value) => {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

// Normalizes currency symbols to ISO 3-letter codes
const normalizeCurrency = (value) => {
  if (!value) return 'USD';
  const currency = String(value).toUpperCase().trim();
  const map = { RS: 'INR', RUPEES: 'INR', '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP' };
  return map[currency] || currency;
};

module.exports = {
  normalizeDate,
  normalizeAmount,
  normalizeVendor,
  normalizeCurrency,
};
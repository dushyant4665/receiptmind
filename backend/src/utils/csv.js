// Escapes and quotes CSV values
const quoteCsv = (value) => {
  if (value === null || value === undefined) return '""';
  return `"${String(value).trim().replace(/"/g, '""')}"`;
};

// Formats date to YYYY-MM-DD
const toIsoDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
};

// Formats date to YYYY-MM-DD HH:mm:ss
const toIsoDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace('T', ' ').split('.')[0];
};

module.exports = {
  quoteCsv,
  toIsoDate,
  toIsoDateTime,
};

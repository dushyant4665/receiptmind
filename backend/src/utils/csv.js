const quoteCsv = (value) => {
  if (value === null || value === undefined) return '""';
  return `"${String(value).trim().replace(/"/g, '""')}"`;
};

const toIsoDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const toIsoDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').split('.')[0];
};

module.exports = {
  quoteCsv,
  toIsoDate,
  toIsoDateTime,
};

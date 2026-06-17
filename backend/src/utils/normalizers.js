const normalizeDate = (value) => {

  if (!value)
    return null;

  value = String(value)
    .trim();

  // Already ISO format
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const parts =
    value.split(/[\/\-\.]/);

  if (parts.length !== 3)
    return null;

  let day;
  let month;
  let year;

  // YYYY-MM-DD
  if (parts[0].length === 4) {

    [year, month, day] = parts;

  } else {

    // DD-MM-YYYY
    [day, month, year] = parts;
  }

  day =
    String(day)
      .padStart(2, '0');

  month =
    String(month)
      .padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const normalizeAmount = (value) => {

  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(/[₹,$€£]/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .trim();

  const parsed =
    parseFloat(cleaned);

  if (isNaN(parsed))
    return 0;

  return parsed;
};

const normalizeVendor = (value) => {

  if (!value)
    return '';

  return String(value)
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeCurrency = (value) => {

  if (!value)
    return 'INR';

  const currency =
    String(value)
      .toUpperCase()
      .trim();

  const mapping = {
    'RS': 'INR',
    'RUPEES': 'INR',
    '₹': 'INR',
    '$': 'USD',
  };

  return mapping[currency]
    || currency;
};

module.exports = {
  normalizeDate,
  normalizeAmount,
  normalizeVendor,
  normalizeCurrency,
};
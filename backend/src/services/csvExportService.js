const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { quoteCsv, toIsoDate } = require('../utils/csv');

// Ensure exports folder exists at the project root level
const exportDir = path.resolve(__dirname, '../../exports');
if (!fsSync.existsSync(exportDir)) {
  fsSync.mkdirSync(exportDir, { recursive: true });
}

const csvPath = path.join(exportDir, 'receipts_peak.csv');

/**
 * Appends a receipt record into the peak exports CSV.
 * Columns:
 * 1. Receipt ID
 * 2. Vendor
 * 3. Amount
 * 4. Currency
 * 5. Category
 * 6. Date
 * 7. Confidence %
 * 8. Status
 */
async function appendReceipt(record) {
  // If the file does not exist, write the header row first
  let fileExists = false;
  try {
    await fs.access(csvPath);
    fileExists = true;
  } catch (err) {
    fileExists = false;
  }

  if (!fileExists) {
    const headers = [
      'Receipt ID',
      'Vendor Name',
      'Amount',
      'Currency',
      'Category',
      'Receipt Date',
      'Confidence',
      'Status'
    ];
    // UTF-8 BOM helps Excel detect UTF-8 encoding automatically
    const bom = '\ufeff';
    const headerRow = bom + headers.map(quoteCsv).join(',') + '\n';
    await fs.writeFile(csvPath, headerRow, 'utf8');
  }

  const confidencePct = typeof record.confidence === 'number' 
    ? `${(record.confidence * 100).toFixed(0)}%` 
    : '0%';

  const row = [
    record.id || '',
    record.vendor_name || 'Unknown',
    record.amount || 0,
    record.currency || 'USD',
    record.category || 'General',
    toIsoDate(record.receipt_date),
    confidencePct,
    record.status || 'processed'
  ];

  const csvRow = row.map(quoteCsv).join(',') + '\n';
  await fs.appendFile(csvPath, csvRow, 'utf8');
}

module.exports = {
  appendReceipt,
  csvPath
};

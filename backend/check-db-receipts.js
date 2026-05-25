require('dotenv').config();
const db = require('./src/config/db');

(async () => {
  try {
    console.log('Checking receipts table...');
    const { rows } = await db.query('SELECT id, status, vendor_name, amount, receipt_date, category, confidence FROM receipts LIMIT 10');
    console.log('Receipts found:', rows.length);
    console.log('Receipts data:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error checking DB:', error);
  } finally {
    process.exit(0);
  }
})();

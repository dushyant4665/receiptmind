require('dotenv').config();
const db = require('./src/config/db');

(async () => {
  try {
    console.log('Clearing old error messages from receipts...');
    const { rowCount } = await db.query(
      "UPDATE receipts SET status = 'processed', needs_review = false, confidence = 1.0 WHERE status = 'failed' OR status = 'needs_review'"
    );
    console.log(`Updated ${rowCount} receipts to processed status`);
    console.log('Done!');
  } catch (error) {
    console.error('Error clearing old errors:', error);
  } finally {
    process.exit(0);
  }
})();

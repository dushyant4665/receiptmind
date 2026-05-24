const db = require('../config/db');
const crypto = require('crypto');

const checkAndCreate = async (receiptId, organizationId, extraction) => {
  const exceptions = [];

  if (extraction.confidence < 0.75) {
    exceptions.push({ 
      type: 'low_confidence', 
      field: 'confidence', 
      message: `AI confidence is ${extraction.confidence.toFixed(2)}, below threshold 0.75` 
    });
  }

  if (!extraction.vendor_name) {
    exceptions.push({ type: 'missing_field', field: 'vendor_name', message: 'Vendor name could not be extracted' });
  }

  if (!extraction.amount || extraction.amount <= 0) {
    exceptions.push({ type: 'missing_field', field: 'amount', message: 'Amount could not be extracted or is zero' });
  }

  if (!extraction.receipt_date) {
    exceptions.push({ type: 'missing_field', field: 'receipt_date', message: 'Receipt date could not be extracted' });
  }

  // Duplicate check
  if (extraction.vendor_name && extraction.amount > 0) {
    try {
      const { rows: potentialDuplicates } = await db.query(
        `SELECT id, amount FROM receipts 
         WHERE organization_id = $1 AND vendor_name = $2 AND id != $3 AND status = 'processed'
         AND created_at > NOW() - INTERVAL '3 days'`,
        [organizationId, extraction.vendor_name, receiptId]
      );

      for (const dup of potentialDuplicates) {
        if (dup.amount > 0 && Math.abs(dup.amount - extraction.amount) / dup.amount <= 0.01) {
          exceptions.push({
            type: 'duplicate',
            field: 'amount',
            message: `Possible duplicate of receipt ${dup.id} (same vendor, similar amount)`
          });
          break; // Only need one duplicate exception
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  }

  try {
    for (const ex of exceptions) {
      await db.query(
        'INSERT INTO exceptions (id, receipt_id, organization_id, type, field, message, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [crypto.randomUUID(), receiptId, organizationId, ex.type, ex.field, ex.message, 'open']
      );
    }
  } catch (error) {
    console.error('Error creating exceptions:', error);
  }
};

const resolve = async (id, organizationId) => {
  await db.query(
    "UPDATE exceptions SET status = 'resolved' WHERE id = $1 AND organization_id = $2",
    [id, organizationId]
  );
};

const getByOrganization = async (organizationId, status) => {
  let query = 'SELECT * FROM exceptions WHERE organization_id = $1';
  const params = [organizationId];

  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const { rows } = await db.query(query, params);
  return rows;
};

module.exports = {
  checkAndCreate,
  resolve,
  getByOrganization,
};

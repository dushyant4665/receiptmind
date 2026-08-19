const crypto = require('crypto');
const db = require('../config/db');

// Evaluates receipt data and generates exceptions if issues are found
const checkAndCreate = async (receiptId, organizationId, extraction) => {
  const exceptions = [];

  if (extraction.confidence < 0.75) {
    exceptions.push({
      type: 'low_confidence',
      field: 'confidence',
      message: `AI confidence is ${(extraction.confidence * 100).toFixed(0)}%, which is below the 75% review threshold.`,
    });
  }

  if (!extraction.vendor_name) {
    exceptions.push({
      type: 'missing_field',
      field: 'vendor_name',
      message: 'Vendor name could not be identified.',
    });
  }

  if (!extraction.amount || extraction.amount <= 0) {
    exceptions.push({
      type: 'missing_field',
      field: 'amount',
      message: 'Total amount is missing or invalid.',
    });
  }

  if (!extraction.receipt_date) {
    exceptions.push({
      type: 'missing_field',
      field: 'receipt_date',
      message: 'Receipt date could not be parsed.',
    });
  }

  // Duplicate receipt check within 3 days
  if (extraction.vendor_name && extraction.amount > 0) {
    try {
      const { rows: dups } = await db.query(
        `SELECT id, amount FROM receipts
         WHERE organization_id = $1 AND vendor_name = $2 AND id != $3 AND status = 'processed'
         AND created_at > NOW() - INTERVAL '3 days'`,
        [organizationId, extraction.vendor_name, receiptId]
      );

      for (const dup of dups) {
        if (dup.amount > 0 && Math.abs(dup.amount - extraction.amount) / dup.amount <= 0.01) {
          exceptions.push({
            type: 'duplicate',
            field: 'amount',
            message: `Possible duplicate of receipt ${dup.id.slice(0, 8)} (same vendor, matching amount).`,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Duplicate check error:', err.message);
    }
  }

  // Insert exceptions into database
  for (const ex of exceptions) {
    await db.query(
      `INSERT INTO exceptions (id, receipt_id, organization_id, type, field, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [crypto.randomUUID(), receiptId, organizationId, ex.type, ex.field, ex.message]
    );
  }

  return exceptions;
};

// Resolves an exception
const resolve = async (id, organizationId) => {
  await db.query(
    `UPDATE exceptions SET status = 'resolved' WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
};

// Lists exceptions for an organization
const getByOrganization = async (organizationId, status) => {
  let sql = 'SELECT * FROM exceptions WHERE organization_id = $1';
  const params = [organizationId];

  if (status) {
    sql += ' AND status = $2';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';
  const { rows } = await db.query(sql, params);
  return rows;
};

module.exports = {
  checkAndCreate,
  resolve,
  getByOrganization,
};

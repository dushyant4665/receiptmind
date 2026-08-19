const crypto = require('crypto');
const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const { quoteCsv, toIsoDate, toIsoDateTime } = require('../utils/csv');

const exportCSV = async (req, res) => {
  const { organizationId, userId } = req.user;
  const { start_date, end_date, status } = req.query;

  try {
    const exportId = crypto.randomUUID();
    const filename = `receipts_${new Date().toISOString().split('T')[0]}.csv`;
    const filters = JSON.stringify({ start_date, end_date, status });

    await db.query(
      `INSERT INTO export_history (id, organization_id, user_id, export_type, filters, file_name, created_at)
       VALUES ($1, $2, $3, 'csv', $4::jsonb, $5, NOW())`,
      [exportId, organizationId, userId, filters, filename]
    );

    let query = `
      SELECT id, vendor_name, amount, currency, category, receipt_date, confidence, status, file_name, needs_review, created_at
      FROM receipts
      WHERE organization_id = $1 AND deleted_at IS NULL
    `;
    const params = [organizationId];
    let idx = 2;

    if (start_date) {
      query += ` AND COALESCE(receipt_date, created_at) >= $${idx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND COALESCE(receipt_date, created_at) <= $${idx++}`;
      params.push(end_date);
    }
    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await db.query(query, params);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const header = ['Receipt ID', 'Vendor', 'Amount', 'Currency', 'Category', 'Date', 'Confidence %', 'Status', 'File Name', 'Needs Review', 'Created At'];
    let csv = header.join(',') + '\n';

    for (const r of rows) {
      const line = [
        r.id,
        quoteCsv(r.vendor_name || 'Unknown'),
        r.amount || 0,
        r.currency || 'USD',
        quoteCsv(r.category || 'General'),
        toIsoDate(r.receipt_date || r.created_at),
        `${Math.round((r.confidence || 0) * 100)}%`,
        r.status,
        quoteCsv(r.file_name || ''),
        Boolean(r.needs_review),
        toIsoDateTime(r.created_at),
      ];
      csv += line.join(',') + '\n';
    }

    await db.query('UPDATE export_history SET row_count = $1 WHERE id = $2', [rows.length, exportId]);
    return res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error.message);
    return res.status(500).json(errorResponse('Failed to generate CSV export'));
  }
};

const getHistory = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT id, export_type, filters, row_count, COALESCE(file_name, '') as file_name, created_at
       FROM export_history
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [organizationId]
    );

    return res.status(200).json(successResponse(rows));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to retrieve export history'));
  }
};

module.exports = {
  exportCSV,
  getHistory,
};

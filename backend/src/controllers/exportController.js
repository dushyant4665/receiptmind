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
      `INSERT INTO export_history (id, organization_id, user_id, export_type, filters, file_name)
       VALUES ($1, $2, $3, 'csv', $4::jsonb, $5)`,
      [exportId, organizationId, userId, filters, filename]
    );

    let query = `SELECT
                  id,
                  COALESCE(
                    NULLIF(vendor_name, ''),
                    NULLIF(raw_vendor_name, ''),
                    NULLIF(ai_output->>'vendor_name', ''),
                    NULLIF(raw_extraction->>'vendor_name', ''),
                    'Unknown'
                  ) AS export_vendor,
                  COALESCE(
                    NULLIF(amount, 0),
                    NULLIF(raw_amount, 0),
                    CASE
                      WHEN regexp_replace(COALESCE(ai_output->>'amount', ''), '[,$ ]', '', 'g') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      THEN regexp_replace(ai_output->>'amount', '[,$ ]', '', 'g')::numeric
                    END,
                    CASE
                      WHEN regexp_replace(COALESCE(raw_extraction->>'amount', ''), '[,$ ]', '', 'g') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                      THEN regexp_replace(raw_extraction->>'amount', '[,$ ]', '', 'g')::numeric
                    END,
                    0
                  )::double precision AS export_amount,
                  COALESCE(
                    NULLIF(category, ''),
                    NULLIF(raw_category, ''),
                    NULLIF(ai_output->>'category', ''),
                    NULLIF(raw_extraction->>'category', ''),
                    'Uncategorized'
                  ) AS export_category,
                  COALESCE(
                    receipt_date,
                    raw_date,
                    CASE WHEN COALESCE(ai_output->>'receipt_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (ai_output->>'receipt_date')::date END,
                    CASE WHEN COALESCE(ai_output->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (ai_output->>'date')::date END,
                    CASE WHEN COALESCE(raw_extraction->>'receipt_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (raw_extraction->>'receipt_date')::date END,
                    created_at
                  ) AS export_date,
                  COALESCE(
                    NULLIF(confidence, 0),
                    NULLIF(raw_confidence, 0),
                    CASE
                      WHEN COALESCE(ai_output->>'confidence', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                      THEN (ai_output->>'confidence')::double precision
                    END,
                    CASE
                      WHEN COALESCE(raw_extraction->>'confidence', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                      THEN (raw_extraction->>'confidence')::double precision
                    END,
                    0
                  ) AS export_confidence,
                  status,
                  COALESCE(NULLIF(currency, ''), 'USD') AS export_currency,
                  COALESCE(NULLIF(source, ''), 'upload') AS export_source,
                  COALESCE(NULLIF(file_name, ''), file_path, '') AS export_file_name,
                  needs_review,
                  created_at,
                  COALESCE(updated_at, created_at) AS export_updated_at
                FROM receipts WHERE organization_id = $1`;
    const params = [organizationId];
    let paramIdx = 2;

    if (start_date) {
      query += ` AND COALESCE(receipt_date, raw_date, created_at) >= $${paramIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND COALESCE(receipt_date, raw_date, created_at) <= $${paramIdx++}`;
      params.push(end_date);
    }
    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ' ORDER BY COALESCE(receipt_date, raw_date, created_at) DESC';

    const { rows } = await db.query(query, params);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const header = [
      'Receipt ID', 'Vendor', 'Amount', 'Currency', 'Category', 'Receipt Date',
      'Confidence %', 'Status', 'Source', 'File Name', 'Needs Review', 'Created At', 'Updated At'
    ];

    let csvContent = header.join(',') + '\n';

    for (const r of rows) {
      const row = [
        r.id,
        quoteCsv(r.export_vendor || ''),
        r.export_amount,
        r.export_currency,
        quoteCsv(r.export_category || ''),
        `\t${toIsoDate(r.export_date)}`,
        `${(r.export_confidence * 100).toFixed(0)}%`,
        r.status,
        r.export_source,
        quoteCsv(r.export_file_name || ''),
        r.needs_review,
        `\t${toIsoDateTime(r.created_at)}`,
        `\t${toIsoDateTime(r.export_updated_at)}`
      ];
      csvContent += row.join(',') + '\n';
    }

    await db.query('UPDATE export_history SET row_count = $1 WHERE id = $2', [rows.length, exportId]);

    res.send(csvContent);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json(errorResponse('Internal server error'));
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

    res.json(successResponse(rows));
  } catch (error) {
    console.error('Export history error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  exportCSV,
  getHistory,
};

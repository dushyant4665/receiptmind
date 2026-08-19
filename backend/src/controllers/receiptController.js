const fs = require('fs/promises');
const crypto = require('crypto');
const db = require('../config/db');
const storageService = require('../services/storageService');
const receiptQueue = require('../queues/receiptQueue');
const ruleService = require('../services/ruleService');
const exceptionService = require('../services/exceptionService');
const { quoteCsv, toIsoDate, toIsoDateTime } = require('../utils/csv');
const { successResponse, errorResponse } = require('../utils/response');

// 1. UPLOAD RECEIPT
const upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file uploaded'));
    }

    const { organizationId, userId } = req.user;
    const fileBuffer = await fs.readFile(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check duplicate
    const { rows: dups } = await db.query(
      `SELECT id FROM receipts WHERE organization_id = $1 AND file_hash = $2 AND deleted_at IS NULL LIMIT 1`,
      [organizationId, fileHash]
    );

    if (dups.length > 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(409).json(errorResponse('Duplicate receipt detected'));
    }

    // Save to storage
    const storedPath = await storageService.uploadFile(fileBuffer, req.file.originalname, organizationId);
    await fs.unlink(req.file.path).catch(() => {});

    const receiptId = crypto.randomUUID();
    const fileUrl = storageService.getFileURL(storedPath);

    // Insert receipt record
    await db.query(
      `INSERT INTO receipts (
        id, organization_id, user_id, file_path, file_url, file_name, file_hash,
        status, processing_state, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'queued', NOW(), NOW())`,
      [receiptId, organizationId, userId, storedPath, fileUrl, req.file.originalname, fileHash]
    );

    // Save storage object record
    await db.query(
      `INSERT INTO storage_objects (id, organization_id, receipt_id, path, file_hash, size_bytes, content_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [crypto.randomUUID(), organizationId, receiptId, storedPath, fileHash, req.file.size, req.file.mimetype]
    );

    // Trigger processing pipeline (in-process async)
    await receiptQueue.add('process-receipt', { receiptId, filePath: storedPath, organizationId });

    return res.status(201).json(
      successResponse({
        id: receiptId,
        receipt_id: receiptId,
        status: 'pending',
        processing_state: 'queued',
        file_url: fileUrl,
      })
    );
  } catch (error) {
    console.error('Upload receipt error:', error.message);
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json(errorResponse('Failed to upload receipt'));
  }
};

// 2. LIST RECEIPTS
const listReceipts = async (req, res) => {
  const { organizationId } = req.user;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const { search, status, start_date, end_date, min_amount, max_amount } = req.query;

  try {
    let whereClause = 'WHERE r.organization_id = $1 AND r.deleted_at IS NULL';
    const params = [organizationId];
    let idx = 2;

    if (search) {
      whereClause += ` AND (r.vendor_name ILIKE $${idx} OR r.category ILIKE $${idx} OR r.file_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    if (status && status !== 'all') {
      whereClause += ` AND r.status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (start_date) {
      whereClause += ` AND COALESCE(r.receipt_date, r.created_at) >= $${idx}`;
      params.push(start_date);
      idx++;
    }

    if (end_date) {
      whereClause += ` AND COALESCE(r.receipt_date, r.created_at) <= $${idx}`;
      params.push(end_date);
      idx++;
    }

    if (min_amount) {
      whereClause += ` AND r.amount >= $${idx}`;
      params.push(parseFloat(min_amount));
      idx++;
    }

    if (max_amount) {
      whereClause += ` AND r.amount <= $${idx}`;
      params.push(parseFloat(max_amount));
      idx++;
    }

    // Total count query
    const countQuery = `SELECT COUNT(*) FROM receipts r ${whereClause}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count, 10);

    // List query
    const listQuery = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'receipt_id', e.receipt_id,
              'organization_id', e.organization_id,
              'type', e.type,
              'field', e.field,
              'message', e.message,
              'status', e.status,
              'created_at', e.created_at
            )
          ) FILTER (WHERE e.id IS NOT NULL), '[]'
        ) as exceptions
      FROM receipts r
      LEFT JOIN exceptions e ON e.receipt_id = r.id AND e.status = 'open'
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    params.push(limit, offset);
    const { rows: receipts } = await db.query(listQuery, params);

    // Ensure file_url is dynamically generated with current host
    const formattedReceipts = receipts.map((r) => ({
      ...r,
      file_url: storageService.getFileURL(r.file_path),
    }));

    return res.status(200).json(
      successResponse({
        receipts: formattedReceipts,
        total,
        limit,
        offset,
      })
    );
  } catch (error) {
    console.error('List receipts error:', error.message);
    return res.status(500).json(errorResponse('Failed to list receipts'));
  }
};

// 3. GET SINGLE RECEIPT
const getReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'receipt_id', e.receipt_id,
              'organization_id', e.organization_id,
              'type', e.type,
              'field', e.field,
              'message', e.message,
              'status', e.status,
              'created_at', e.created_at
            )
          ) FILTER (WHERE e.id IS NOT NULL), '[]'
        ) as exceptions
       FROM receipts r
       LEFT JOIN exceptions e ON e.receipt_id = r.id AND e.status = 'open'
       WHERE r.id = $1 AND r.organization_id = $2 AND r.deleted_at IS NULL
       GROUP BY r.id LIMIT 1`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    const receipt = rows[0];
    receipt.file_url = storageService.getFileURL(receipt.file_path);

    return res.status(200).json(successResponse(receipt));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to retrieve receipt'));
  }
};

// 4. EDIT RECEIPT
const editReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;
  const edits = req.validatedData || req.body || {};

  try {
    const { rows: existing } = await db.query(
      'SELECT id, vendor_name, category, status FROM receipts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    const fields = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(edits)) {
      if (['vendor_name', 'amount', 'subtotal', 'tax_amount', 'receipt_date', 'currency', 'category', 'invoice_number', 'payment_method', 'is_billable', 'is_reimbursable'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      fields.push(`status = 'processed'`);
      fields.push(`needs_review = false`);

      params.push(id, organizationId);
      const updateQuery = `UPDATE receipts SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`;
      const { rows: updated } = await db.query(updateQuery, params);

      // Resolve open exceptions for this receipt
      await db.query(
        `UPDATE exceptions SET status = 'resolved' WHERE receipt_id = $1 AND organization_id = $2`,
        [id, organizationId]
      );

      // Auto-learn rule if vendor or category changed
      const vendorName = edits.vendor_name || existing[0].vendor_name;
      const category = edits.category || existing[0].category;
      if (vendorName && category) {
        ruleService.autoLearnFromEdit(organizationId, vendorName, category).catch(() => {});
      }

      const receipt = updated[0];
      receipt.file_url = storageService.getFileURL(receipt.file_path);
      return res.status(200).json(successResponse(receipt));
    }

    const receipt = existing[0];
    receipt.file_url = storageService.getFileURL(receipt.file_path);
    return res.status(200).json(successResponse(receipt));
  } catch (error) {
    console.error('Edit receipt error:', error.message);
    return res.status(500).json(errorResponse('Failed to update receipt'));
  }
};

// 5. DELETE RECEIPT
const deleteReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      'UPDATE receipts SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING file_path',
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    return res.status(200).json(successResponse({ id, message: 'Receipt deleted successfully' }));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to delete receipt'));
  }
};

// 6. BULK DELETE RECEIPTS
const bulkDeleteReceipts = async (req, res) => {
  const { organizationId } = req.user;
  const { ids } = req.validatedData || req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json(errorResponse('ids array is required'));
  }

  try {
    await db.query(
      'UPDATE receipts SET deleted_at = NOW() WHERE id = ANY($1::uuid[]) AND organization_id = $2',
      [ids, organizationId]
    );

    return res.status(200).json(successResponse({ deletedCount: ids.length }));
  } catch (error) {
    return res.status(500).json(errorResponse('Bulk delete failed'));
  }
};

// 7. BULK EXPORT RECEIPTS
const bulkExportReceipts = async (req, res) => {
  const { organizationId } = req.user;
  const { ids } = req.validatedData || req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json(errorResponse('ids array is required'));
  }

  try {
    const { rows } = await db.query(
      `SELECT id, vendor_name, amount, currency, category, receipt_date, confidence, status, file_name, created_at
       FROM receipts
       WHERE id = ANY($1::uuid[]) AND organization_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [ids, organizationId]
    );

    const filename = `receipts_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const header = ['Receipt ID', 'Vendor', 'Amount', 'Currency', 'Category', 'Date', 'Confidence', 'Status', 'File Name', 'Created At'];
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
        toIsoDateTime(r.created_at),
      ];
      csv += line.join(',') + '\n';
    }

    return res.send(csv);
  } catch (error) {
    return res.status(500).json(errorResponse('Bulk export failed'));
  }
};

// 8. LIST EXPENSES
const listExpenses = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT id, vendor_name, amount, currency, category, receipt_date, status, confidence, file_name, file_path, created_at
       FROM receipts
       WHERE organization_id = $1 AND deleted_at IS NULL AND (status = 'processed' OR status = 'needs_review')
       ORDER BY created_at DESC`,
      [organizationId]
    );

    const expenses = rows.map((r) => ({
      ...r,
      file_url: storageService.getFileURL(r.file_path),
    }));

    return res.status(200).json(successResponse(expenses));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to list expenses'));
  }
};

module.exports = {
  upload,
  listReceipts,
  getReceipt,
  editReceipt,
  deleteReceipt,
  bulkDeleteReceipts,
  bulkExportReceipts,
  listExpenses,
};
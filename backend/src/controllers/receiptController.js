const crypto = require('crypto');
const path = require('path');
const db = require('../config/db');
const { client: redis } = require('../config/redis');
const storageService = require('../services/storageService');
const queueService = require('../services/queueService');
const ruleService = require('../services/ruleService');
const { successResponse, errorResponse } = require('../utils/response');

const upload = async (req, res) => {
  const { userId, organizationId } = req.user;
  const file = req.file;

  if (!file) {
    return res.status(400).json(errorResponse('File is required'));
  }

  // Validate file type via mimetype
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return res.status(400).json(errorResponse('File type not allowed. Accepted: jpg, png, webp, heic, pdf'));
  }

  // Validate file size (10MB)
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760;
  if (file.size > maxFileSize) {
    return res.status(400).json(errorResponse('File size exceeds 10MB limit'));
  }

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  try {
    // Check for duplicate
    const { rows: duplicate } = await db.query(
      'SELECT id FROM receipts WHERE organization_id = $1 AND file_hash = $2 AND status != $3 LIMIT 1',
      [organizationId, fileHash, 'failed']
    );

    if (duplicate.length > 0) {
      return res.status(409).json(errorResponse(`Duplicate: this file was already uploaded (receipt ${duplicate[0].id})`));
    }

    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const filePath = await storageService.uploadFile(file.buffer, file.originalname, organizationId);
    const receiptId = crypto.randomUUID();

    await db.query(
      `INSERT INTO receipts (id, organization_id, user_id, file_path, file_url, file_name, file_hash, status, processing_state, currency, line_items, is_billable, is_reimbursable, needs_review, source, raw_extraction, user_corrections, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', 'queued', 'USD', '[]'::jsonb, false, false, false, 'upload', '{}'::jsonb, '{}'::jsonb, NOW())`,
      [receiptId, organizationId, userId, filePath, base64Data, file.originalname, fileHash]
    );

    await db.query(
      `INSERT INTO storage_objects (id, organization_id, receipt_id, path, file_hash, size_bytes, content_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [crypto.randomUUID(), organizationId, receiptId, filePath, fileHash, file.size, file.mimetype]
    );

    await queueService.enqueueReceipt(receiptId, filePath, organizationId, 'high');

    await db.query(
      `INSERT INTO receipt_processing_jobs (id, receipt_id, organization_id, processing_state)
       VALUES ($1, $2, $3, 'queued')`,
      [crypto.randomUUID(), receiptId, organizationId]
    );

    // Invalidate cache
    await invalidateCache(organizationId);

    res.status(201).json(successResponse({
      id: receiptId,
      receipt_id: receiptId,
      status: 'processing',
      file_url: base64Data,
      vendor_name: 'AI Extracting...',
      created_at: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const getReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT r.id, r.organization_id, r.user_id, r.file_path, r.file_url, r.status,
              r.raw_vendor_name, r.raw_amount, r.raw_date, r.raw_category, r.raw_confidence,
              r.vendor_name, r.amount, r.receipt_date, r.category, r.confidence, r.created_at,
              j.last_error
       FROM receipts r
       LEFT JOIN receipt_processing_jobs j ON r.id = j.receipt_id
       WHERE r.id = $1 AND r.organization_id = $2`,
      [id, organizationId]
    );

    const receipt = rows[0];
    if (!receipt) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    const { rows: exceptions } = await db.query(
      'SELECT * FROM exceptions WHERE receipt_id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    const resp = mapReceipt(receipt);
    resp.exceptions = exceptions;

    if (!resp.file_url) {
      resp.file_url = await storageService.getSignedURL(receipt.file_path);
    }

    res.json(successResponse(resp));
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const listReceipts = async (req, res) => {
  const { organizationId } = req.user;
  let { limit = 20, offset = 0, search, status, start_date, end_date, min_amount, max_amount } = req.query;

  limit = parseInt(limit);
  offset = parseInt(offset);

  try {
    const cacheKey = `receipts:${organizationId}:${limit}:${offset}:${search}:${status}:${start_date}:${end_date}:${min_amount}:${max_amount}`;
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    }

    let query = `SELECT r.id, r.organization_id, r.user_id, r.file_path, r.file_url, r.status,
                        r.raw_vendor_name, r.raw_amount, r.raw_date, r.raw_category, r.raw_confidence,
                        r.vendor_name, r.amount, r.receipt_date, r.category, r.confidence, r.created_at,
                        j.last_error
                 FROM receipts r
                 LEFT JOIN receipt_processing_jobs j ON r.id = j.receipt_id
                 WHERE r.organization_id = $1`;
    let countQuery = 'SELECT COUNT(*) FROM receipts r WHERE r.organization_id = $1';
    const params = [organizationId];
    let paramIdx = 2;

    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch.startsWith('>') || trimmedSearch.startsWith('<')) {
        const operator = trimmedSearch[0];
        const amt = parseFloat(trimmedSearch.substring(1).trim());
        if (!isNaN(amt)) {
          query += ` AND amount ${operator} $${paramIdx}`;
          countQuery += ` AND amount ${operator} $${paramIdx}`;
          params.push(amt);
          paramIdx++;
        }
      } else if (trimmedSearch.toLowerCase() === 'last month') {
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query += ` AND receipt_date >= $${paramIdx} AND receipt_date < $${paramIdx + 1}`;
        countQuery += ` AND receipt_date >= $${paramIdx} AND receipt_date < $${paramIdx + 1}`;
        params.push(startOfLastMonth, startOfCurrentMonth);
        paramIdx += 2;
      } else {
        query += ` AND (vendor_name ILIKE $${paramIdx} OR raw_vendor_name ILIKE $${paramIdx} OR category ILIKE $${paramIdx})`;
        countQuery += ` AND (vendor_name ILIKE $${paramIdx} OR raw_vendor_name ILIKE $${paramIdx} OR category ILIKE $${paramIdx})`;
        params.push(`%${trimmedSearch}%`);
        paramIdx++;
      }
    }

    if (status) {
      query += ` AND status = $${paramIdx}`;
      countQuery += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (start_date) {
      query += ` AND receipt_date >= $${paramIdx}`;
      countQuery += ` AND receipt_date >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }

    if (end_date) {
      query += ` AND receipt_date <= $${paramIdx}`;
      countQuery += ` AND receipt_date <= $${paramIdx}`;
      params.push(end_date);
      paramIdx++;
    }

    if (min_amount) {
      query += ` AND amount >= $${paramIdx}`;
      countQuery += ` AND amount >= $${paramIdx}`;
      params.push(parseFloat(min_amount));
      paramIdx++;
    }

    if (max_amount) {
      query += ` AND amount <= $${paramIdx}`;
      countQuery += ` AND amount <= $${paramIdx}`;
      params.push(parseFloat(max_amount));
      paramIdx++;
    }

    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count);

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const { rows: receipts } = await db.query(query, params);

    const data = {
      receipts: receipts.map(mapReceipt),
      total,
      limit,
      offset,
    };

    if (redis) {
      await redis.setEx(cacheKey, 10, JSON.stringify(successResponse(data)));
    }

    res.setHeader('X-Cache', redis ? 'MISS' : 'DISABLED');
    res.json(successResponse(data));
  } catch (error) {
    console.error('List receipts error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const editReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;
  const { vendor_name, amount, receipt_date, category } = req.body;

  try {
    const { rows: existing } = await db.query(
      'SELECT id, vendor_name, category FROM receipts WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (vendor_name !== undefined) {
      updates.push(`vendor_name = $${paramIdx++}`);
      params.push(vendor_name);
    }
    if (amount !== undefined) {
      updates.push(`amount = $${paramIdx++}`);
      params.push(amount);
    }
    if (receipt_date !== undefined) {
      updates.push(`receipt_date = $${paramIdx++}`);
      params.push(receipt_date);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIdx++}`);
      params.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json(errorResponse('No fields to update'));
    }

    // Auto-learn if category changed
    if (category && category !== existing[0].category) {
      const vName = vendor_name || existing[0].vendor_name;
      if (vName) {
        await ruleService.autoLearnFromEdit(organizationId, vName, category);
      }
    }

    params.push(id, organizationId);
    const query = `UPDATE receipts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIdx} AND organization_id = $${paramIdx + 1}`;

    await db.query(query, params);

    await invalidateCache(organizationId);

    res.json(successResponse({ id, updated: true }));
  } catch (error) {
    console.error('Edit receipt error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const deleteReceipt = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      'SELECT file_path FROM receipts WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Receipt not found'));
    }

    const filePath = rows[0].file_path;
    await storageService.deleteFile(filePath);

    await db.query('UPDATE storage_objects SET deleted_at = NOW() WHERE organization_id = $1 AND path = $2', [organizationId, filePath]);
    await db.query('DELETE FROM receipts WHERE id = $1 AND organization_id = $2', [id, organizationId]);

    await invalidateCache(organizationId);

    res.json(successResponse({ id, deleted: true }));
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const bulkDeleteReceipts = async (req, res) => {
  const { organizationId } = req.user;
  const { receipt_ids } = req.body;

  if (!receipt_ids || !Array.isArray(receipt_ids) || receipt_ids.length === 0) {
    return res.status(400).json(errorResponse('No receipt IDs provided'));
  }

  try {
    // Get file paths first
    const { rows: files } = await db.query(
      'SELECT file_path FROM receipts WHERE id = ANY($1) AND organization_id = $2',
      [receipt_ids, organizationId]
    );

    for (const file of files) {
      try {
        await storageService.deleteFile(file.file_path);
        await db.query('UPDATE storage_objects SET deleted_at = NOW() WHERE organization_id = $1 AND path = $2', [organizationId, file.file_path]);
      } catch (err) {
        console.error(`Failed to delete file ${file.file_path}:`, err);
      }
    }

    await db.query(
      'DELETE FROM receipts WHERE id = ANY($1) AND organization_id = $2',
      [receipt_ids, organizationId]
    );

    await invalidateCache(organizationId);

    res.json(successResponse({ count: receipt_ids.length, deleted: true }));
  } catch (error) {
    console.error('Bulk delete receipts error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const bulkExportReceipts = async (req, res) => {
  const { organizationId } = req.user;
  const { receipt_ids } = req.body;

  if (!receipt_ids || !Array.isArray(receipt_ids) || receipt_ids.length === 0) {
    return res.status(400).json(errorResponse('No receipt IDs provided'));
  }

  try {
    const filename = `bulk_export_${new Date().toISOString().split('T')[0]}.csv`;
    const query = `SELECT
                    id,
                    COALESCE(vendor_name, raw_vendor_name, 'Unknown') AS export_vendor,
                    COALESCE(amount, raw_amount, 0) AS export_amount,
                    COALESCE(category, raw_category, 'Uncategorized') AS export_category,
                    COALESCE(receipt_date, raw_date, created_at) AS export_date,
                    COALESCE(confidence, raw_confidence, 0) AS export_confidence,
                    status,
                    COALESCE(currency, 'USD') AS export_currency,
                    COALESCE(source, 'upload') AS export_source,
                    COALESCE(file_name, file_path, '') AS export_file_name,
                    created_at
                  FROM receipts 
                  WHERE organization_id = $1 AND id = ANY($2)
                  ORDER BY created_at DESC`;

    const { rows } = await db.query(query, [organizationId, receipt_ids]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const header = ['Receipt ID', 'Vendor', 'Amount', 'Currency', 'Category', 'Receipt Date', 'Confidence %', 'Status', 'Source', 'File Name', 'Created At'];
    let csvContent = header.join(',') + '\n';

    for (const r of rows) {
      const row = [
        r.id,
        `"${(r.export_vendor || '').replace(/"/g, '""')}"`,
        r.export_amount,
        r.export_currency,
        `"${(r.export_category || '').replace(/"/g, '""')}"`,
        r.export_date instanceof Date ? r.export_date.toISOString().split('T')[0] : r.export_date,
        `${(r.export_confidence * 100).toFixed(0)}%`,
        r.status,
        r.export_source,
        `"${(r.export_file_name || '').replace(/"/g, '""')}"`,
        r.created_at.toISOString()
      ];
      csvContent += row.join(',') + '\n';
    }

    res.send(csvContent);
  } catch (error) {
    console.error('Bulk export error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const listExpenses = async (req, res) => {
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT id, COALESCE(vendor_name, raw_vendor_name, 'Unknown') as vendor_name, 
              COALESCE(amount, 0) as amount, COALESCE(receipt_date, created_at) as receipt_date, 
              COALESCE(category, 'Uncategorized') as category, status
       FROM receipts WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [organizationId]
    );

    const expenses = rows.map(r => ({
      id: r.id,
      vendor_name: r.vendor_name,
      amount: parseFloat(r.amount),
      currency: 'USD',
      date: r.receipt_date instanceof Date ? r.receipt_date.toISOString().split('T')[0] : r.receipt_date,
      category: r.category,
      description: 'Receipt upload',
      status: r.status,
    }));

    res.json(successResponse(expenses));
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

const invalidateCache = async (organizationId) => {
  if (!redis) {
    return;
  }
  await redis.del(`dashboard:${organizationId}`);
  const keys = await redis.keys(`receipts:${organizationId}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
};

const mapReceipt = (r) => ({
  id: r.id,
  organization_id: r.organization_id,
  user_id: r.user_id,
  status: r.status,
  vendor_name: r.vendor_name,
  amount: r.amount,
  receipt_date: r.receipt_date,
  category: r.category,
  confidence: r.confidence,
  file_url: r.file_url,
  created_at: r.created_at,
  error_message: r.last_error,
});

module.exports = {
  upload,
  getReceipt,
  listReceipts,
  editReceipt,
  deleteReceipt,
  bulkDeleteReceipts,
  bulkExportReceipts,
  listExpenses,
};

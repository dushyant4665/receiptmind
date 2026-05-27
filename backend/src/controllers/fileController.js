const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { errorResponse } = require('../utils/response');

const storageRoot = path.resolve(process.env.STORAGE_PATH || './uploads');
const resolveStoredFilePath = (storedPath) => path.resolve(storageRoot, storedPath);

const getFile = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      'SELECT path, content_type FROM storage_objects WHERE receipt_id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, organizationId]
    );

    if (rows.length === 0) {
      // Try receipts table if not in storage_objects
      const { rows: receiptRows } = await db.query(
        'SELECT file_path FROM receipts WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );
      
      if (receiptRows.length === 0) {
        return res.status(404).json(errorResponse('File not found'));
      }
      
      const filePath = resolveStoredFilePath(receiptRows[0].file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errorResponse('File not found on disk'));
      }
      return res.sendFile(filePath);
    }

    const filePath = resolveStoredFilePath(rows[0].path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(errorResponse('File not found on disk'));
    }

    if (rows[0].content_type) {
      res.setHeader('Content-Type', rows[0].content_type);
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  getFile,
};

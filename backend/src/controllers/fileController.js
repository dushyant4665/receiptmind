const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { STORAGE_ROOT } = require('../services/storageService');
const { errorResponse } = require('../utils/response');

const getFile = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      `SELECT file_path FROM receipts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('File not found'));
    }

    const filePath = path.join(STORAGE_ROOT, rows[0].file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(errorResponse('File does not exist on disk'));
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to retrieve file'));
  }
};

module.exports = {
  getFile,
};

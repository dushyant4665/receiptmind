const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { errorResponse } = require('../utils/response');

const getFile = async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  try {
    const { rows } = await db.query(
      'SELECT file_path, file_url FROM receipts WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Receipt file not found'));
    }

    const { file_path: filePath, file_url: fileUrl } = rows[0];

    // If we have a base64 stored URL, serve it as a binary
    if (fileUrl && fileUrl.startsWith('data:')) {
      const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }
    }

    // Try local file paths
    const storagePath = process.env.STORAGE_PATH || './uploads';
    const uploadsDir = path.resolve(__dirname, '../..', storagePath.replace('./', ''));
    const fullPath = path.join(uploadsDir, filePath);

    if (fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }

    // Fallback: try relative to backend root
    const altPath = path.resolve(__dirname, '../../uploads', filePath);
    if (fs.existsSync(altPath)) {
      return res.sendFile(altPath);
    }

    return res.status(404).json(errorResponse('File not found on disk'));
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json(errorResponse('Internal server error'));
  }
};

module.exports = {
  getFile,
};

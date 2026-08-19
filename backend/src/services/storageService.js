require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH || path.join(__dirname, '../../uploads'));

// Saves file buffer to disk under organization folder
const uploadFile = async (buffer, originalFilename, organizationId) => {
  const ext = path.extname(originalFilename).toLowerCase();
  const orgDir = path.join(STORAGE_ROOT, organizationId);
  await fs.mkdir(orgDir, { recursive: true });

  const safeFilename = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(orgDir, safeFilename);
  await fs.writeFile(fullPath, buffer);

  // Return relative path like "org-123/file.jpg"
  return path.join(organizationId, safeFilename).replace(/\\/g, '/');
};

// Reads file buffer from storage
const downloadFile = async (relativePath) => {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  return await fs.readFile(fullPath);
};

// Deletes file from storage
const deleteFile = async (relativePath) => {
  try {
    const fullPath = path.join(STORAGE_ROOT, relativePath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.warn('Storage delete warning:', error.message);
  }
};

// Generates public or API preview URL for uploaded receipt
const getFileURL = (relativePath) => {
  const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
};

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileURL,
  STORAGE_ROOT,
};
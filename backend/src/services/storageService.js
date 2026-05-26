const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ override: true });

const storageRoot = path.resolve(process.env.STORAGE_PATH || './uploads');

const ensureParentDir = (targetPath) => {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const resolveStoragePath = (filePath) => path.join(storageRoot, filePath);

const uploadFile = async (buffer, filename, orgId) => {
  const ext = path.extname(filename);
  const newFilename = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(orgId, newFilename);
  const fullPath = resolveStoragePath(filePath);

  ensureParentDir(fullPath);
  fs.writeFileSync(fullPath, buffer);

  return filePath;
};

const getSignedURL = async (filePath) => {
  // For local storage, we just return the URL to the file
  return `${process.env.BASE_URL}/uploads/${filePath}`;
};

const deleteFile = async (filePath) => {
  const fullPath = resolveStoragePath(filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

const downloadFile = async (filePath) => {
  const fullPath = resolveStoragePath(filePath);
  return fs.readFileSync(fullPath);
};

module.exports = {
  uploadFile,
  getSignedURL,
  deleteFile,
  downloadFile,
};

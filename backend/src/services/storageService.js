const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const uploadFile = async (buffer, filename, orgId) => {
  const ext = path.extname(filename);
  const newFilename = `${crypto.randomUUID()}${ext}`;
  const orgDir = path.join(process.env.STORAGE_PATH, orgId);

  if (!fs.existsSync(orgDir)) {
    fs.mkdirSync(orgDir, { recursive: true });
  }

  const filePath = path.join(orgId, newFilename);
  const fullPath = path.join(process.env.STORAGE_PATH, filePath);

  fs.writeFileSync(fullPath, buffer);

  return filePath;
};

const getSignedURL = async (filePath) => {
  // For local storage, we just return the URL to the file
  return `${process.env.BASE_URL}/uploads/${filePath}`;
};

const deleteFile = async (filePath) => {
  const fullPath = path.join(process.env.STORAGE_PATH, filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

const downloadFile = async (filePath) => {
  const fullPath = path.join(process.env.STORAGE_PATH, filePath);
  return fs.readFileSync(fullPath);
};

module.exports = {
  uploadFile,
  getSignedURL,
  deleteFile,
  downloadFile,
};

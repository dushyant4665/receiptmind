const fs = require('fs/promises');

const path = require('path');

const crypto = require('crypto');

require('dotenv').config();

/*
  ====================================
  STORAGE ROOT
  ====================================
*/

const STORAGE_ROOT =
  process.env.STORAGE_PATH ||
  path.join(__dirname, '../../storage');

/*
  ====================================
  ENSURE DIRECTORY EXISTS
  ====================================
*/

const ensureDirectoryExists =
  async (dirPath) => {

    await fs.mkdir(
      dirPath,
      {
        recursive: true,
      }
    );
  };

/*
  ====================================
  SAFE FILE EXTENSION
  ====================================
*/

const getSafeExtension =
  (filename) => {

    const ext =
      path.extname(filename)
        .toLowerCase();

    const allowed = [
      '.jpg',
      '.jpeg',
      '.png',
      '.pdf',
      '.webp',
    ];

    if (!allowed.includes(ext)) {
      throw new Error(
        'Unsupported file type'
      );
    }

    return ext;
  };

/*
  ====================================
  UPLOAD FILE
  ====================================
*/

const uploadFile = async (
  buffer,
  originalFilename,
  organizationId
) => {

  /*
    ================================
    VALIDATE EXTENSION
    ================================
  */

  const ext =
    getSafeExtension(
      originalFilename
    );

  /*
    ================================
    ORG DIRECTORY
    ================================
  */

  const orgDirectory =
    path.join(
      STORAGE_ROOT,
      organizationId
    );

  await ensureDirectoryExists(
    orgDirectory
  );

  /*
    ================================
    GENERATE SAFE FILE NAME
    ================================
  */

  const safeFilename =
    `${crypto.randomUUID()}${ext}`;

  /*
    ================================
    FULL FILE PATH
    ================================
  */

  const fullPath =
    path.join(
      orgDirectory,
      safeFilename
    );

  /*
    ================================
    WRITE FILE
    ================================
  */

  await fs.writeFile(
    fullPath,
    buffer
  );

  /*
    ================================
    RELATIVE FILE PATH
    ================================
  */

  const relativePath =
    path.join(
      organizationId,
      safeFilename
    );

  return relativePath;
};

/*
  ====================================
  DOWNLOAD FILE
  ====================================
*/

const downloadFile = async (
  relativePath
) => {

  const normalized =
    path.normalize(relativePath);

  const fullPath =
    path.join(
      STORAGE_ROOT,
      normalized
    );

  return await fs.readFile(
    fullPath
  );
};

/*
  ====================================
  DELETE FILE
  ====================================
*/

const deleteFile = async (
  relativePath
) => {

  try {

    const normalized =
      path.normalize(relativePath);

    const fullPath =
      path.join(
        STORAGE_ROOT,
        normalized
      );

    await fs.unlink(fullPath);

  } catch (error) {

    console.warn(
      'Delete warning:',
      error.message
    );
  }
};

/*
  ====================================
  SIGNED URL
  ====================================
*/

const getSignedURL = async (
  relativePath
) => {

  return `${process.env.BASE_URL}/uploads/${relativePath}`;
};

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedURL,
};
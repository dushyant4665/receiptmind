const multer = require('multer');

const path = require('path');

const fs = require('fs/promises');

const crypto = require('crypto');

/*
  ====================================
  TEMP DIRECTORY
  ====================================
*/

const TEMP_DIR =
  path.join(
    __dirname,
    '../../temp'
  );

/*
  ====================================
  ENSURE TEMP EXISTS
  ====================================
*/

const ensureTempDir = async () => {

  await fs.mkdir(
    TEMP_DIR,
    {
      recursive: true,
    }
  );
};

ensureTempDir();

/*
  ====================================
  ALLOWED MIME TYPES
  ====================================
*/

const allowedMimeTypes = [

  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/*
  ====================================
  DISK STORAGE
  ====================================
*/

const storage =
  multer.diskStorage({

    destination:
      async (
        req,
        file,
        cb
      ) => {

        try {

          await ensureTempDir();

          cb(
            null,
            TEMP_DIR
          );

        } catch (error) {

          cb(error);
        }
      },

    filename:
      (
        req,
        file,
        cb
      ) => {

        const ext =
          path.extname(
            file.originalname
          );

        const filename =
          `${crypto.randomUUID()}${ext}`;

        cb(
          null,
          filename
        );
      },
  });

/*
  ====================================
  FILE FILTER
  ====================================
*/

const fileFilter = (
  req,
  file,
  cb
) => {

  if (
    !allowedMimeTypes.includes(
      file.mimetype
    )
  ) {

    return cb(
      new Error(
        'Unsupported file type'
      )
    );
  }

  cb(null, true);
};

/*
  ====================================
  MULTER INSTANCE
  ====================================
*/

const upload =
  multer({

    storage,

    fileFilter,

    limits: {

      fileSize:
        10 * 1024 * 1024,
    },
  });

module.exports = {
  upload,
};
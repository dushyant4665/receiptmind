const fs = require('fs/promises');

const crypto = require('crypto');

const db =
  require('../config/db');

const storageService =
  require('../services/storageService');

const receiptQueue =
  require('../queues/receiptQueue');

const {
  successResponse,
  errorResponse,
} = require('../utils/response');

/*
  =====================================
  UPLOAD RECEIPT
  =====================================
*/

const upload = async (
  req,
  res
) => {

  try {

    /*
      ================================
      FILE VALIDATION
      ================================
    */

    if (!req.file) {

      return res
        .status(400)
        .json(
          errorResponse(
            'No file uploaded'
          )
        );
    }

    /*
      ================================
      READ TEMP FILE
      ================================
    */

    const fileBuffer =
      await fs.readFile(
        req.file.path
      );

    /*
      ================================
      FILE HASH
      ================================
    */

    const fileHash =
      crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

    /*
      ================================
      DUPLICATE CHECK
      ================================
    */

    const duplicateCheck =
      await db.query(
        `
          SELECT id
          FROM receipts
          WHERE
            organization_id = $1
            AND file_hash = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [
          req.user.organizationId,
          fileHash,
        ]
      );

    if (
      duplicateCheck.rows.length > 0
    ) {

      await fs.unlink(
        req.file.path
      );

      return res
        .status(409)
        .json(
          errorResponse(
            'Duplicate receipt detected'
          )
        );
    }

    /*
      ================================
      STORE FILE
      ================================
    */

    const filePath =
      await storageService.uploadFile(

        fileBuffer,

        req.file.originalname,

        req.user.organizationId
      );

    /*
      ================================
      DELETE TEMP FILE
      ================================
    */

    await fs.unlink(
      req.file.path
    );

    /*
      ================================
      CREATE RECEIPT ID
      ================================
    */

    const receiptId =
      crypto.randomUUID();

    /*
      ================================
      INSERT RECEIPT
      ================================
    */

    await db.query(
      `
        INSERT INTO receipts (

          id,
          organization_id,
          uploaded_by,

          original_filename,
          mime_type,
          file_size,

          file_path,
          file_hash,

          status,
          processing_state,

          created_at,
          updated_at

        )
        VALUES (

          $1,
          $2,
          $3,

          $4,
          $5,
          $6,

          $7,
          $8,

          'processing',
          'queued',

          NOW(),
          NOW()
        )
      `,
      [

        receiptId,

        req.user.organizationId,

        req.user.userId,

        req.file.originalname,

        req.file.mimetype,

        req.file.size,

        filePath,

        fileHash,
      ]
    );

    /*
      ================================
      QUEUE JOB
      ================================
    */

    await receiptQueue.add(

      'process-receipt',

      {

        receiptId,

        filePath,

        organizationId:
          req.user.organizationId,
      },

      {

        attempts: 3,

        backoff: {

          type: 'exponential',

          delay: 3000,
        },

        removeOnComplete: 100,

        removeOnFail: 50,
      }
    );

    /*
      ================================
      RESPONSE
      ================================
    */

    return res
      .status(201)
      .json(
        successResponse({

          id: receiptId,

          status: 'processing',

          processing_state:
            'queued',
        })
      );

  } catch (error) {

    console.error(
      'Receipt Upload Error:',
      error.message
    );

    /*
      ================================
      CLEAN TEMP FILE
      ================================
    */

    if (
      req.file?.path
    ) {

      try {

        await fs.unlink(
          req.file.path
        );

      } catch (_) {}
    }

    return res
      .status(500)
      .json(
        errorResponse(
          'Receipt upload failed'
        )
      );
  }
};

module.exports = {
  upload,
};
const db = require('../config/db');

const storageService =
  require('./storageService');

const aiService =
  require('./aiService');

const ruleService =
  require('./ruleService');

const exceptionService =
  require('./exceptionService');

/*
  =====================================
  UPDATE PROCESSING STATUS
  =====================================
*/

const updateReceiptStatus = async (
  receiptId,
  status,
  processingState
) => {

  await db.query(
    `
      UPDATE receipts
      SET
        status = $1,
        processing_state = $2,
        updated_at = NOW()
      WHERE id = $3
    `,
    [
      status,
      processingState,
      receiptId,
    ]
  );
};

/*
  =====================================
  SAVE EXTRACTION RESULTS
  =====================================
*/

const saveExtractionResults = async (
  receiptId,
  extraction
) => {

  const needsReview =
    extraction.needs_review;

  const finalStatus =
    needsReview
      ? 'needs_review'
      : 'processed';

  await db.query(
    `
      UPDATE receipts
      SET

        status = $1,
        processing_state = $2,

        vendor_name = $3,
        amount = $4,
        subtotal = $5,
        tax_amount = $6,

        receipt_date = $7,
        currency = $8,
        category = $9,

        invoice_number = $10,
        payment_method = $11,

        confidence = $12,
        validation_confidence = $13,
        final_confidence = $14,

        raw_extraction = $15,
        ai_output = $16,

        needs_review = $17,

        processing_finished_at = NOW(),
        updated_at = NOW()

      WHERE id = $18
    `,
    [

      finalStatus,
      finalStatus,

      extraction.vendor_name,
      extraction.amount,
      extraction.subtotal,
      extraction.tax_amount,

      extraction.receipt_date,
      extraction.currency,
      extraction.category,

      extraction.invoice_number,
      extraction.payment_method,

      extraction.confidence,
      extraction.confidence,
      extraction.confidence,

      extraction,
      {
        raw_response:
          extraction.raw_ai_response,
      },

      needsReview,

      receiptId,
    ]
  );

  return finalStatus;
};

/*
  =====================================
  MAIN PROCESSOR
  =====================================
*/

const processReceipt = async (
  receiptId,
  filePath,
  organizationId
) => {

  console.log(
    `Processing receipt ${receiptId}`
  );

  try {

    /*
      ================================
      SET PROCESSING STATUS
      ================================
    */

    await updateReceiptStatus(
      receiptId,
      'processing',
      'processing'
    );

    /*
      ================================
      DOWNLOAD FILE
      ================================
    */

    const fileBuffer =
      await storageService.downloadFile(
        filePath
      );

    /*
      ================================
      MIME DETECTION
      ================================
    */

    const ext =
      filePath.toLowerCase();

    let mimeType =
      'image/jpeg';

    if (ext.endsWith('.png')) {
      mimeType = 'image/png';
    }

    if (ext.endsWith('.pdf')) {
      mimeType =
        'application/pdf';
    }

    if (ext.endsWith('.webp')) {
      mimeType = 'image/webp';
    }

    /*
      ================================
      AI EXTRACTION
      ================================
    */

    const extraction =
      await aiService.extractWithContext(
        fileBuffer,
        '',
        mimeType
      );

    /*
      ================================
      APPLY RULE ENGINE
      ================================
    */

    const finalExtraction =
      await ruleService.applyRules(
        organizationId,
        extraction
      );

    /*
      ================================
      SAVE RESULTS
      ================================
    */

    const finalStatus =
      await saveExtractionResults(
        receiptId,
        finalExtraction
      );

    /*
      ================================
      EXCEPTION SYSTEM
      ================================
    */

    await exceptionService.checkAndCreate(
      receiptId,
      organizationId,
      finalExtraction
    );

    console.log(
      `Receipt ${receiptId} completed`
    );

    return {
      success: true,
      status: finalStatus,
    };

  } catch (error) {

    console.error(
      `Receipt Processing Error:`,
      error.message
    );

    /*
      ================================
      FAILED STATUS
      ================================
    */

    await db.query(
      `
        UPDATE receipts
        SET
          status = 'failed',
          processing_state = 'failed',
          updated_at = NOW()
        WHERE id = $1
      `,
      [receiptId]
    );

    /*
      ================================
      EXCEPTION RECORD
      ================================
    */

    await db.query(
      `
        INSERT INTO exceptions (
          id,
          receipt_id,
          organization_id,
          type,
          field,
          message,
          status
        )
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          'processing_error',
          'system',
          $3,
          'open'
        )
      `,
      [
        receiptId,
        organizationId,
        error.message,
      ]
    );

    throw error;
  }
};

module.exports = {
  processReceipt,
};
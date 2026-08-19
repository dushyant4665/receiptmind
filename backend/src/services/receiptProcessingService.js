const db = require('../config/db');
const storageService = require('./storageService');
const aiService = require('./aiService');
const ocrService = require('./ocrService');
const ruleService = require('./ruleService');
const exceptionService = require('./exceptionService');
const crypto = require('crypto');

// Detects mime type from file path extension
const getMimeType = (filePath) => {
  const ext = filePath.toLowerCase();
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.webp')) return 'image/webp';
  if (ext.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
};

// Main processing pipeline for an uploaded receipt
const processReceipt = async (receiptId, filePath, organizationId) => {
  console.log(`[Processing Pipeline] Starting receipt: ${receiptId}`);

  try {
    // 1. Mark status as processing
    await db.query(
      `UPDATE receipts
       SET status = 'processing', processing_state = 'processing', processing_started_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [receiptId]
    );

    // 2. Read file from storage
    const fileBuffer = await storageService.downloadFile(filePath);
    const mimeType = getMimeType(filePath);

    // 3. Extract OCR text (if image)
    const ocrText = await ocrService.extractText(fileBuffer, mimeType);

    // 4. AI Extraction with multi-provider failover
    const aiExtraction = await aiService.extractWithContext(fileBuffer, ocrText, mimeType);

    // 5. Apply business rules and vendor aliases
    const finalExtraction = await ruleService.applyRules(organizationId, aiExtraction);

    // 6. Check for exceptions (low confidence, missing data, duplicates)
    const exceptions = await exceptionService.checkAndCreate(receiptId, organizationId, finalExtraction);

    // 7. Decide final receipt status
    const hasOpenExceptions = exceptions.length > 0;
    const finalStatus = hasOpenExceptions || finalExtraction.needs_review ? 'needs_review' : 'processed';

    // 8. Update receipt record in database
    await db.query(
      `UPDATE receipts
       SET
         status = $1,
         processing_state = $1,
         vendor_name = $2,
         amount = $3,
         subtotal = $4,
         tax_amount = $5,
         receipt_date = $6,
         currency = $7,
         category = $8,
         invoice_number = $9,
         payment_method = $10,
         confidence = $11,
         validation_confidence = $11,
         final_confidence = $11,
         raw_extraction = $12,
         ai_output = $13,
         needs_review = $14,
         processing_finished_at = NOW(),
         updated_at = NOW()
       WHERE id = $15`,
      [
        finalStatus,
        finalExtraction.vendor_name || null,
        finalExtraction.amount || 0,
        finalExtraction.subtotal || 0,
        finalExtraction.tax_amount || 0,
        finalExtraction.receipt_date || null,
        finalExtraction.currency || 'USD',
        finalExtraction.category || 'General',
        finalExtraction.invoice_number || null,
        finalExtraction.payment_method || null,
        finalExtraction.confidence || 0,
        JSON.stringify(finalExtraction),
        JSON.stringify({ raw_response: finalExtraction.raw_ai_response || '' }),
        finalStatus === 'needs_review',
        receiptId,
      ]
    );

    console.log(`[Processing Pipeline] Completed receipt ${receiptId} -> Status: ${finalStatus}`);
    return { success: true, status: finalStatus };
  } catch (error) {
    console.error(`[Processing Pipeline] Error on receipt ${receiptId}:`, error.message);

    // Update receipt status to failed
    await db.query(
      `UPDATE receipts
       SET status = 'failed', processing_state = 'failed', processing_finished_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [receiptId]
    );

    // Create system error exception
    await db.query(
      `INSERT INTO exceptions (id, receipt_id, organization_id, type, field, message, status)
       VALUES ($1, $2, $3, 'processing_error', 'system', $4, 'open')`,
      [crypto.randomUUID(), receiptId, organizationId, error.message]
    );

    throw error;
  }
};

module.exports = {
  processReceipt,
};
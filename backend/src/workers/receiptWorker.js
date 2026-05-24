const Queue = require('bull');
const db = require('../config/db');
const storageService = require('../services/storageService');
const aiService = require('../services/aiService');
const ruleService = require('../services/ruleService');
const exceptionService = require('../services/exceptionService');
const ocrService = require('../services/ocrService');
require('dotenv').config();

const startWorker = () => {
  const receiptQueue = new Queue('receipt-processing', process.env.REDIS_URL);

  receiptQueue.process(5, async (job) => {
    const { receiptId, filePath, orgId } = job.data;
    console.log(`Processing receipt ${receiptId} for org ${orgId}`);

    try {
      // Update status to processing
      await db.query(
        "UPDATE receipts SET status = 'processing', processing_state = 'processing', processing_started_at = COALESCE(processing_started_at, NOW()), updated_at = NOW() WHERE id = $1",
        [receiptId]
      );

      await db.query(
        `UPDATE receipt_processing_jobs
         SET processing_state = 'processing', attempts = attempts + 1, started_at = COALESCE(started_at, NOW()), updated_at = NOW(), queue_job_id = $1
         WHERE receipt_id = $2 AND processing_state IN ('queued', 'processing')`,
        [job.id, receiptId]
      );

      const fileBuffer = await storageService.downloadFile(filePath);
      
      // Detect mimeType from filePath
      const ext = (filePath || '').toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (ext.endsWith('.png')) mimeType = 'image/png';
      else if (ext.endsWith('.webp')) mimeType = 'image/webp';
      else if (ext.endsWith('.heic') || ext.endsWith('.heif')) mimeType = 'image/heic';
      else if (ext.endsWith('.gif')) mimeType = 'image/gif';

      // Perform OCR
      console.log(`Starting OCR for receipt ${receiptId}`);
      const ocrText = await ocrService.extractText(fileBuffer);
      console.log(`OCR completed for receipt ${receiptId}, chars: ${ocrText.length}`);

      // AI Extraction - pass buffer, ocrText, mimeType
      let extraction = await aiService.extractWithContext(fileBuffer, ocrText, mimeType);

      // Apply Rules
      extraction = await ruleService.applyRules(orgId, extraction);

      const needsReview = extraction.confidence < 0.75 || !extraction.vendor_name || extraction.amount <= 0 || !extraction.receipt_date;
      const newStatus = needsReview ? 'needs_review' : 'processed';

      await db.query(
        `UPDATE receipts SET
          status = $1,
          raw_vendor_name = $2,
          raw_amount = $3,
          raw_date = $4,
          raw_category = $5,
          raw_confidence = $6,
          vendor_name = $7,
          amount = $8,
          receipt_date = $9,
          category = $10,
          confidence = $11,
          validation_confidence = $12,
          final_confidence = $13,
          needs_review = $14,
          raw_text = $15,
          ai_output = COALESCE($16::jsonb, '{}'::jsonb),
          processing_state = $17,
          processing_finished_at = NOW(),
          updated_at = NOW()
        WHERE id = $18`,
        [
          newStatus,
          extraction.vendor_name, extraction.amount, extraction.receipt_date || null, extraction.category, extraction.confidence,
          extraction.vendor_name, extraction.amount, extraction.receipt_date || null, extraction.category, extraction.confidence,
          extraction.confidence, extraction.confidence,
          needsReview, ocrText || '', JSON.stringify(extraction.ai_output || {}), newStatus,
          receiptId,
        ]
      );

      await exceptionService.checkAndCreate(receiptId, orgId, extraction);

      await db.query(
        `UPDATE receipt_processing_jobs
         SET processing_state = $1, finished_at = NOW(), updated_at = NOW()
         WHERE receipt_id = $2 AND processing_state = 'processing'`,
        [newStatus, receiptId]
      );

      console.log(`Receipt ${receiptId} processed successfully with status ${newStatus}`);
    } catch (error) {
      console.error(`Error processing receipt ${receiptId}:`, error);
      
      // Extract user-friendly error message
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Make Gemini API errors more user-friendly
      if (errorMessage.includes('Gemini API error')) {
        if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
          errorMessage = 'Gemini API access denied. Please check your API key configuration.';
        } else if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = 'Gemini API quota exceeded. Please try again later.';
        } else if (errorMessage.includes('400') || errorMessage.includes('INVALID_ARGUMENT')) {
          errorMessage = 'Invalid request to Gemini API. Please check file format.';
        }
      }
      
      await db.query(
        "UPDATE receipts SET status = 'failed', processing_state = 'failed', processing_finished_at = NOW(), updated_at = NOW() WHERE id = $1",
        [receiptId]
      );

      await db.query(
        `UPDATE receipt_processing_jobs SET processing_state = 'failed', last_error = $1, finished_at = NOW(), updated_at = NOW() WHERE receipt_id = $2`,
        [errorMessage, receiptId]
      );

      throw error;
    }
  });

  console.log('Bull worker started with concurrency 5');
};

module.exports = startWorker;

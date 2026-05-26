const db = require('../config/db');
const storageService = require('./storageService');
const aiService = require('./aiService');
const ruleService = require('./ruleService');
const exceptionService = require('./exceptionService');
const validationService = require('./validationService');

const processingQueue = [];
let isProcessing = false;
const MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.gif': 'image/gif',
};

const processNextInQueue = async () => {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  const { receiptId, filePath, orgId, resolve, reject } = processingQueue.shift();
  
  try {
    const result = await executeProcessing(receiptId, filePath, orgId);
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isProcessing = false;
    // Set delay to 250ms for near-instant processing
    setTimeout(processNextInQueue, 250);
  }
};

const processReceipt = (receiptId, filePath, orgId) => {
  return new Promise((resolve, reject) => {
    processingQueue.push({ receiptId, filePath, orgId, resolve, reject });
    processNextInQueue();
  });
};

const executeProcessing = async (receiptId, filePath, orgId) => {
  console.log(`Processing receipt ${receiptId} for org ${orgId}`);

  try {
    await db.query(
      "UPDATE receipts SET status = 'processing', processing_state = 'processing', processing_started_at = COALESCE(processing_started_at, NOW()), updated_at = NOW() WHERE id = $1",
      [receiptId]
    );

    await db.query(
      `UPDATE receipt_processing_jobs
       SET processing_state = 'processing', attempts = attempts + 1, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE receipt_id = $1 AND processing_state IN ('queued', 'processing')`,
      [receiptId]
    );

    const fileBuffer = await storageService.downloadFile(filePath);
    const mimeType = detectMimeType(filePath);

    console.log(`Starting AI extraction for receipt ${receiptId}`);
    const extraction = await aiService.extractWithContext(fileBuffer, mimeType);
    
    console.log(`AI extraction finished for receipt ${receiptId}.`);
    
    const ruledExtraction = await ruleService.applyRules(orgId, extraction);
    const { sanitized: finalizedExtraction, needsReview } = validationService.validateExtraction(ruledExtraction);

    // Ensure amount is numeric and date is valid
    const amount = Number(finalizedExtraction.amount) || 0;
    const date = finalizedExtraction.receipt_date || null;
    const vendor = finalizedExtraction.vendor_name || 'Unknown';
    const confidence = Number(finalizedExtraction.confidence) || 0;

    const newStatus = needsReview ? 'needs_review' : 'processed';

    const aiOutput = toStructuredAiOutput(finalizedExtraction);
    const rawExtraction = toRawExtraction(finalizedExtraction);

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
        ai_output = $16,
        raw_extraction = $17,
        currency = $18,
        processing_state = $19,
        processing_finished_at = NOW(),
        updated_at = NOW()
      WHERE id = $20`,
      [
        newStatus,
        vendor, amount, date, finalizedExtraction.category, confidence,
        vendor, amount, date, finalizedExtraction.category, confidence,
        confidence, confidence,
        needsReview, finalizedExtraction.raw_text || '', aiOutput || {}, rawExtraction || {}, finalizedExtraction.currency || 'USD', newStatus,
        receiptId,
      ]
    );

    await exceptionService.checkAndCreate(receiptId, orgId, finalizedExtraction);

    await db.query(
      `UPDATE receipt_processing_jobs
       SET processing_state = $1, finished_at = NOW(), updated_at = NOW()
       WHERE receipt_id = $2 AND processing_state = 'processing'`,
      [newStatus, receiptId]
    );

    console.log(`Receipt ${receiptId} processed successfully with status ${newStatus}`);
    return { success: true, status: newStatus };
  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    
    const errorMessage = mapProcessingError(error);
    
    await db.query(
      "UPDATE receipts SET status = 'failed', processing_state = 'failed', processing_finished_at = NOW(), updated_at = NOW() WHERE id = $1",
      [receiptId]
    );

    await db.query(
      `UPDATE receipt_processing_jobs SET processing_state = 'failed', last_error = $1, finished_at = NOW(), updated_at = NOW() WHERE receipt_id = $2`,
      [errorMessage, receiptId]
    );

    // No need to throw here as it's a background process, but we log it
    console.error(`Final processing failure for ${receiptId}: ${errorMessage}`);
  }
};

const detectMimeType = (filePath) => {
  const lowerPath = String(filePath || '').toLowerCase();
  const extension = Object.keys(MIME_BY_EXTENSION).find((ext) => lowerPath.endsWith(ext));
  return extension ? MIME_BY_EXTENSION[extension] : 'image/jpeg';
};

const mapProcessingError = (error) => {
  const message = error?.message || 'Unknown error occurred';

  if (message.includes('Gemini API error')) {
    if (message.includes('403') || message.includes('PERMISSION_DENIED')) {
      return 'Gemini API access denied. Please check your API key configuration.';
    }
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return 'Gemini API quota exceeded. Free tier limit reached.';
    }
    if (message.includes('400') || message.includes('INVALID_ARGUMENT')) {
      return 'Invalid request format sent to Gemini. Please try a different file.';
    }
    if (message.includes('500') || message.includes('INTERNAL')) {
      return 'Gemini Server Error. Please try again in a few minutes.';
    }
  }

  if (message.includes('Failed to parse AI response')) {
    return 'AI returned an unreadable response. This often happens with very blurry receipts.';
  }

  return message;
};

const toStructuredAiOutput = (extraction) => ({
  vendor_name: extraction.vendor_name || '',
  amount: Number(extraction.amount) || 0,
  subtotal: Number(extraction.subtotal) || 0,
  tax_amount: Number(extraction.tax_amount) || 0,
  category: extraction.category || '',
  currency: extraction.currency || 'USD',
  receipt_date: extraction.receipt_date || '',
  due_date: extraction.due_date || '',
  confidence: Number(extraction.confidence) || 0,
  provider: extraction.provider || '',
  model: extraction.model || '',
  raw_response: extraction.ai_output || '',
});

const toRawExtraction = (extraction) => ({
  invoice_number: extraction.invoice_number || '',
  invoice_date: extraction.invoice_date || '',
  receipt_date: extraction.receipt_date || '',
  due_date: extraction.due_date || '',
  vendor_name: extraction.vendor_name || '',
  vendor_gstin: extraction.vendor_gstin || '',
  buyer_name: extraction.buyer_name || '',
  buyer_gstin: extraction.buyer_gstin || '',
  amount: Number(extraction.amount) || 0,
  subtotal: Number(extraction.subtotal) || 0,
  tax_amount: Number(extraction.tax_amount) || 0,
  currency: extraction.currency || 'USD',
  category: extraction.category || '',
  confidence: Number(extraction.confidence) || 0,
});

module.exports = { processReceipt };

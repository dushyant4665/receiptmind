const db = require('../config/db');
const storageService = require('./storageService');
const aiService = require('./aiService');
const ruleService = require('./ruleService');
const exceptionService = require('./exceptionService');
const ocrService = require('./ocrService');

// Simple queue to manage concurrent AI requests
const processingQueue = [];
let isProcessing = false;

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
    // Increased delay to 5 seconds to be extremely safe with Free Tier RPM
    setTimeout(processNextInQueue, 5000);
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
    
    const ext = (filePath || '').toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (ext.endsWith('.png')) mimeType = 'image/png';
    else if (ext.endsWith('.webp')) mimeType = 'image/webp';
    else if (ext.endsWith('.heic') || ext.endsWith('.heif')) mimeType = 'image/heic';
    else if (ext.endsWith('.gif')) mimeType = 'image/gif';

    console.log(`Starting OCR for receipt ${receiptId}`);
    const ocrText = await ocrService.extractText(fileBuffer, mimeType);
    console.log(`OCR completed for receipt ${receiptId}, chars: ${ocrText?.length || 0}`);

    let extraction = await aiService.extractWithContext(fileBuffer, ocrText, mimeType);
    extraction = await ruleService.applyRules(orgId, extraction);

    // Ensure amount is numeric and date is valid
    const amount = Number(extraction.amount) || 0;
    const date = extraction.receipt_date || null;
    const vendor = extraction.vendor_name || 'Unknown';
    const confidence = Number(extraction.confidence) || 0;

    const needsReview = confidence < 0.9 || !extraction.vendor_name || amount <= 0 || !date;
    const newStatus = needsReview ? 'needs_review' : 'processed';

    const aiOutput = toStructuredAiOutput(extraction);
    const rawExtraction = toRawExtraction(extraction);

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
        vendor, amount, date, extraction.category, confidence,
        vendor, amount, date, extraction.category, confidence,
        confidence, confidence,
        needsReview, ocrText || '', aiOutput || {}, rawExtraction || {}, extraction.currency || 'USD', newStatus,
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
    return { success: true, status: newStatus };
  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    
    let errorMessage = error.message || 'Unknown error occurred';
    let errorCategory = 'internal_error';
    
    if (errorMessage.includes('Gemini API error')) {
      if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
        errorMessage = 'Gemini API access denied. Please check your API key configuration.';
        errorCategory = 'auth_error';
      } else if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Gemini API quota exceeded. Free tier limit reached.';
        errorCategory = 'quota_error';
      } else if (errorMessage.includes('400') || errorMessage.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Invalid request format sent to Gemini. Please try a different file.';
        errorCategory = 'format_error';
      } else if (errorMessage.includes('500') || errorMessage.includes('INTERNAL')) {
        errorMessage = 'Gemini Server Error. Please try again in a few minutes.';
        errorCategory = 'ai_service_error';
      }
    } else if (errorMessage.includes('Failed to parse AI response')) {
      errorMessage = 'AI returned an unreadable response. This often happens with very blurry receipts.';
      errorCategory = 'parsing_error';
    }
    
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

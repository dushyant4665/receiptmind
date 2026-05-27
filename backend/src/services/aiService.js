require('dotenv').config({ override: true });
const ocrService = require('./ocrService');
const {
  cleanText,
  normalizeMoney,
  normalizeConfidence,
  normalizeDate,
} = require('./validationService');

const DEFAULT_CATEGORY = 'General';
const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  process.env.GEMINI_FALLBACK_MODEL,
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
].filter(Boolean);

const OPENROUTER_MODEL_CANDIDATES = [
  process.env.OPENAI_MODEL,
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
].filter(Boolean);

/**
 * Main function to extract receipt data using AI.
 * It tries OpenRouter first, then Gemini, and finally falls back to local OCR.
 */
const extractWithContext = async (fileBuffer, mimeType = 'image/jpeg') => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENAI_API_KEY;

  if (!openRouterKey && !geminiKey) {
    throw new Error('No AI provider configured');
  }

  const base64File = toBase64(fileBuffer);
  let lastError = null;

  // Try OpenRouter models
  if (openRouterKey) {
    for (const modelName of OPENROUTER_MODEL_CANDIDATES) {
      try {
        console.log(`Trying OpenRouter with ${modelName}...`);
        const result = await extractWithOpenRouter(openRouterKey, modelName, base64File, mimeType);
        return finalizeExtraction(result, 'openrouter', modelName);
      } catch (error) {
        console.warn(`OpenRouter ${modelName} failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  // Try Gemini models
  if (geminiKey) {
    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        console.log(`Trying Gemini with ${modelName}...`);
        const result = await extractWithGemini(geminiKey, modelName, base64File, mimeType);
        return finalizeExtraction(result, 'gemini', modelName);
      } catch (error) {
        console.warn(`Gemini ${modelName} failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  // Fallback to Tesseract OCR if AI fails
  const ocrText = await ocrService.extractText(fileBuffer, mimeType);
  if (ocrText) {
    console.warn('Falling back to basic OCR extraction.');
    return finalizeExtraction(extractHeuristically(ocrText), 'tesseract', 'ocr-fallback', ocrText);
  }

  throw lastError || new Error('All extraction attempts failed');
};

const extractWithOpenRouter = async (apiKey, modelName, base64File, mimeType) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
      'X-Title': 'ReceiptMind',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(mimeType) },
            ...(mimeType === 'application/pdf'
              ? []
              : [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64File}` } }]),
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.05,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  return parseJson(content);
};

const extractWithGemini = async (apiKey, modelName, base64File, mimeType) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const parts = [{ text: buildPrompt(mimeType) }];

  if (mimeType !== 'application/pdf') {
    parts.push({ inlineData: { mimeType, data: base64File } });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.05, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');

  return parseJson(content);
};

const buildPrompt = (mimeType) => `Extract these fields from the receipt:
- invoice_number, invoice_date, vendor_name, vendor_gstin, buyer_name, amount, subtotal, tax_amount, currency, category, confidence (0-1).
Return only JSON. Document: ${mimeType}`;

const normalizeExtractedNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || '').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseJson = (content) => {
  const clean = content.replace(/```json|```/gi, '').trim();
  try {
    const raw = JSON.parse(clean);
    return {
      invoice_number: String(raw.invoice_number || raw.bill_number || ''),
      invoice_date: String(raw.invoice_date || raw.date || ''),
      vendor_name: String(raw.vendor_name || raw.merchant_name || ''),
      vendor_gstin: String(raw.vendor_gstin || ''),
      buyer_name: String(raw.buyer_name || ''),
      amount: normalizeExtractedNumber(raw.amount || raw.total || 0),
      subtotal: normalizeExtractedNumber(raw.subtotal || 0),
      tax_amount: normalizeExtractedNumber(raw.tax_amount || raw.tax || 0),
      currency: String(raw.currency || 'USD'),
      category: String(raw.category || ''),
      confidence: normalizeExtractedNumber(raw.confidence || 0),
    };
  } catch (e) {
    throw new Error('Failed to parse AI JSON response');
  }
};

const finalizeExtraction = (result, provider, model, rawText = '') => {
  return {
    ...result,
    provider,
    model,
    raw_text: rawText,
    ai_output: { provider, model, fields: { ...result } },
  };
};

const toBase64 = (buffer) => Buffer.isBuffer(buffer) ? buffer.toString('base64') : buffer;

const OCR_VENDOR_STOP_WORDS = new Set([
  'tax invoice',
  'invoice',
  'receipt',
  'bill',
  'cash memo',
  'simplified tax invoice',
]);

const pickVendorName = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 8)) {
    const normalized = line.toLowerCase();
    if (normalized.length < 3 || normalized.length > 60) continue;
    if (/\d{3,}/.test(normalized)) continue;
    if (OCR_VENDOR_STOP_WORDS.has(normalized)) continue;
    if (/gst|phone|table|server|order|token|time|date|total|amount|qty/i.test(line)) continue;
    return line;
  }

  return lines[0] || '';
};

const pickBestAmount = (text) => {
  const amountMatches = [...String(text || '').matchAll(/(?:grand total|total amount|net amount|amount due|amount|total)\s*[:\-]?\s*(?:rs\.?|inr|\$)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi)];
  if (amountMatches.length > 0) {
    return normalizeExtractedNumber(amountMatches[amountMatches.length - 1][1]);
  }

  const fallbackMatches = [...String(text || '').matchAll(/(?:rs\.?|inr|\$)\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi)];
  if (fallbackMatches.length > 0) {
    return Math.max(...fallbackMatches.map((match) => normalizeExtractedNumber(match[1])));
  }

  return 0;
};

const pickBestDate = (text) => {
  const matches = String(text || '').match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g);
  return matches?.[0] || '';
};

const inferCurrency = (text) => {
  if (/\b(?:rs\.?|inr)\b/i.test(text)) return 'INR';
  if (/\$|usd/i.test(text)) return 'USD';
  if (/eur|€/i.test(text)) return 'EUR';
  return 'USD';
};
  
/**
 * Basic heuristic extraction using regex when AI fails.
 */
const extractHeuristically = (text) => {
  const amount = pickBestAmount(text);
  const invoiceNumber =
    text.match(/(?:inv|bill|invoice)\s*(?:no|#|number)?\s*[:\-]?\s*([A-Z0-9-]{3,})/i)?.[1] ||
    '';
  const invoiceDate = pickBestDate(text);
  const vendorName = pickVendorName(text);
  const currency = inferCurrency(text);
  const confidenceSignals = [
    Boolean(vendorName),
    amount > 0,
    Boolean(invoiceDate),
    Boolean(invoiceNumber),
    String(text || '').trim().length > 40,
  ].filter(Boolean).length;
  const confidence = confidenceSignals >= 4 ? 0.82 : confidenceSignals === 3 ? 0.72 : confidenceSignals === 2 ? 0.56 : 0.34;
  
  return {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    vendor_name: vendorName,
    vendor_gstin: '',
    buyer_name: '',
    amount: amount,
    subtotal: amount,
    tax_amount: 0,
    currency,
    category: DEFAULT_CATEGORY,
    confidence,
  };
};

module.exports = { extractWithContext };

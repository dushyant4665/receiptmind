require('dotenv').config();
const sharp = require('sharp');
const { normalizeDate, normalizeAmount, normalizeVendor, normalizeCurrency } = require('../utils/normalizers');
const { buildReceiptPrompt } = require('../utils/prompts');
const { validateExtraction } = require('./validationService');

const MISTRAL_API_KEY = (process.env.MISTRAL_API_KEY || 'VHc9KgTIhHBVVfVUiEG9d8nqShSoqrDk').trim();
const MISTRAL_MODEL = (process.env.MISTRAL_MODEL || 'mistral-ocr-4-1').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
const TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000;

// Preprocess image for optimal OCR and AI vision
const preprocessImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return buffer;
  }
};

// Safe JSON parsing from AI responses
const parseJson = (content) => {
  if (!content) throw new Error('Empty AI response');
  try {
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from AI response');
    return JSON.parse(match[0]);
  }
};

// Normalize extracted receipt fields
const normalizeResult = (parsed, rawResponse) => {
  const normalized = {
    vendor_name: normalizeVendor(parsed.vendor_name || parsed.vendor || parsed.merchant_name || parsed.merchant),
    amount: normalizeAmount(parsed.amount || parsed.total_amount || parsed.total),
    subtotal: normalizeAmount(parsed.subtotal),
    tax_amount: normalizeAmount(parsed.tax_amount || parsed.tax),
    receipt_date: normalizeDate(parsed.receipt_date || parsed.date),
    currency: normalizeCurrency(parsed.currency),
    category: parsed.category || 'General',
    invoice_number: parsed.invoice_number || '',
    payment_method: parsed.payment_method || '',
    confidence: Number(parsed.confidence) || 0.85,
    raw_ai_response: rawResponse,
  };
  return validateExtraction(normalized);
};

// Helper for fetch with timeout
const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// 1. Mistral Vision + Text Extraction (Primary)
const extractWithMistral = async (base64Image, mimeType, ocrText) => {
  if (!MISTRAL_API_KEY) throw new Error('Missing MISTRAL_API_KEY');

  const promptText = buildReceiptPrompt(ocrText);

  // Try Vision with Pixtral if image is available and not a PDF
  if (base64Image && mimeType !== 'application/pdf') {
    try {
      const response = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                { type: 'image_url', image_url: `data:${mimeType};base64,${base64Image}` },
              ],
            },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) return normalizeResult(parseJson(content), content);
      }
    } catch (visionErr) {
      console.warn('Mistral Vision attempt failed, falling back to text:', visionErr.message);
    }
  }

  // Fallback to Mistral text model (mistral-small-latest)
  const response = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: promptText }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return normalizeResult(parseJson(content), content);
};

// 2. Google Gemini Extraction (Fallback)
const extractWithGemini = async (base64Image, mimeType, ocrText) => {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

  const parts = [{ text: buildReceiptPrompt(ocrText) }];
  if (base64Image && mimeType !== 'application/pdf') {
    parts.push({ inlineData: { mimeType, data: base64Image } });
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return normalizeResult(parseJson(content), content);
};

// Main entry point with failover chain
const extractWithContext = async (fileBuffer, ocrText = '', mimeType = 'image/jpeg') => {
  const optimizedBuffer = mimeType !== 'application/pdf' ? await preprocessImage(fileBuffer) : fileBuffer;
  const base64Image = optimizedBuffer.toString('base64');

  const providers = [];

  // Mistral (Primary)
  if (MISTRAL_API_KEY) {
    providers.push({
      name: 'Mistral AI',
      fn: () => extractWithMistral(base64Image, mimeType, ocrText),
    });
  }

  // Gemini (Fallback)
  if (GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini AI',
      fn: () => extractWithGemini(base64Image, mimeType, ocrText),
    });
  }

  let lastError;
  for (const provider of providers) {
    try {
      console.log(`[AI Extraction] Trying ${provider.name}...`);
      return await provider.fn();
    } catch (err) {
      console.warn(`[AI Extraction] ${provider.name} failed:`, err.message);
      lastError = err;
    }
  }

  // If OCR text exists and AI failed, extract basic fields from OCR text
  if (ocrText && ocrText.trim().length > 0) {
    console.log('[AI Extraction] Falling back to rule-based OCR parsing');
    return normalizeResult(
      {
        vendor_name: ocrText.split('\n')[0]?.substring(0, 50) || 'Unknown Vendor',
        amount: 0,
        currency: 'USD',
        category: 'General',
        confidence: 0.5,
      },
      ocrText
    );
  }

  throw new Error(`All extraction providers failed. Last error: ${lastError?.message}`);
};

module.exports = {
  extractWithContext,
};

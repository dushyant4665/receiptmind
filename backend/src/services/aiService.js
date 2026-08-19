require('dotenv').config();
const sharp = require('sharp');
const { normalizeDate, normalizeAmount, normalizeVendor, normalizeCurrency } = require('../utils/normalizers');
const { buildReceiptPrompt } = require('../utils/prompts');
const { validateExtraction } = require('./validationService');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'google/gemini-2.0-flash-001';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001';
const TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000;

// Optimizes image buffer for AI consumption
const preprocessImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize({ width: 1800, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return buffer;
  }
};

// Safe JSON parser from AI output text
const parseJsonFromText = (content) => {
  try {
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI did not return valid JSON');
    return JSON.parse(match[0]);
  }
};

// Formats and normalizes parsed AI object
const normalizeExtractedObject = (parsed, rawText) => {
  const normalized = {
    vendor_name: normalizeVendor(parsed.vendor_name),
    amount: normalizeAmount(parsed.amount),
    subtotal: normalizeAmount(parsed.subtotal),
    tax_amount: normalizeAmount(parsed.tax_amount),
    receipt_date: normalizeDate(parsed.receipt_date),
    currency: normalizeCurrency(parsed.currency),
    category: parsed.category || 'General',
    invoice_number: parsed.invoice_number || '',
    payment_method: parsed.payment_method || '',
    confidence: Number(parsed.confidence) || 0.85,
    raw_ai_response: rawText,
  };
  return validateExtraction(normalized);
};

// Fetch with abort timeout
const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// Extract using OpenRouter API
const extractWithOpenRouter = async (base64Image, mimeType, ocrText) => {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'ReceiptMind',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildReceiptPrompt(ocrText) },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  return normalizeExtractedObject(parseJsonFromText(content), content);
};

// Extract using Google Gemini REST API
const extractWithGemini = async (base64Image, mimeType, ocrText, modelName) => {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildReceiptPrompt(ocrText) },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');

  return normalizeExtractedObject(parseJsonFromText(content), content);
};

// Main entry point with automated provider failover
const extractWithContext = async (fileBuffer, ocrText = '', mimeType = 'image/jpeg') => {
  const optimizedBuffer = mimeType !== 'application/pdf' ? await preprocessImage(fileBuffer) : fileBuffer;
  const base64Image = optimizedBuffer.toString('base64');

  const providers = [];

  // 1. Try OpenRouter if configured
  if (OPENROUTER_API_KEY && mimeType !== 'application/pdf') {
    providers.push({
      name: 'OpenRouter',
      fn: () => extractWithOpenRouter(base64Image, mimeType, ocrText),
    });
  }

  // 2. Try Gemini Primary if configured
  if (GEMINI_API_KEY) {
    providers.push({
      name: `Gemini (${GEMINI_MODEL})`,
      fn: () => extractWithGemini(base64Image, mimeType, ocrText, GEMINI_MODEL),
    });

    // 3. Try Gemini Fallback
    if (GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) {
      providers.push({
        name: `Gemini Fallback (${GEMINI_FALLBACK_MODEL})`,
        fn: () => extractWithGemini(base64Image, mimeType, ocrText, GEMINI_FALLBACK_MODEL),
      });
    }
  }

  if (providers.length === 0) {
    console.warn('No AI API keys configured. Returning placeholder receipt extraction.');
    return validateExtraction({
      vendor_name: 'Sample Store',
      amount: 45.0,
      subtotal: 40.0,
      tax_amount: 5.0,
      receipt_date: new Date().toISOString().split('T')[0],
      currency: 'USD',
      category: 'General',
      confidence: 0.85,
    });
  }

  let lastError;
  for (const provider of providers) {
    try {
      console.log(`Extracting receipt using ${provider.name}...`);
      return await provider.fn();
    } catch (err) {
      lastError = err;
      console.warn(`${provider.name} extraction failed:`, err.message);
    }
  }

  throw new Error(`All AI extraction providers failed. Last error: ${lastError?.message}`);
};

module.exports = {
  extractWithContext,
};

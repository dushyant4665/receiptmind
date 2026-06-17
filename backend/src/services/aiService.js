require('dotenv').config();

const sharp = require('sharp');

const {
  normalizeDate,
  normalizeAmount,
  normalizeVendor,
  normalizeCurrency,
} = require('../utils/normalizers');

const {
  buildReceiptPrompt,
} = require('../utils/prompts');

const {
  validateExtraction,
} = require('./validationService');

const AI_TIMEOUT_MS =
  Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000;

const AI_RETRIES =
  Math.max(
    0,
    Number(process.env.AI_MAX_RETRIES) || 1
  );

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENAI_API_KEY ||
  '';

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ||
  process.env.OPENAI_MODEL ||
  '';

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || '';

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  'gemini-2.0-flash';

const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ||
  'gemini-2.0-flash-001';

const isPdf = (mimeType) =>
  mimeType === 'application/pdf';

const isImageMimeType = (mimeType) =>
  Boolean(mimeType) && !isPdf(mimeType);

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

const getErrorMessage = (error) =>
  error?.name === 'AbortError'
    ? 'Request timed out'
    : error?.message || String(error);

const preprocessImage = async (buffer) => {
  return sharp(buffer)
    .resize({
      width: 1800,
      withoutEnlargement: true,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .jpeg({
      quality: 90,
    })
    .toBuffer();
};

const parseAIResponse = (content) => {
  try {
    const cleaned = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Failed to parse AI JSON response');
    }

    return JSON.parse(match[0]);
  }
};

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMs = AI_TIMEOUT_MS
) => {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const toBase64Image = async (
  fileBuffer,
  mimeType
) => {
  if (isImageMimeType(mimeType)) {
    const optimizedImage =
      await preprocessImage(fileBuffer);

    return optimizedImage.toString('base64');
  }

  return fileBuffer.toString('base64');
};

const normalizeExtraction = (parsed, rawContent) => {
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
    confidence: Number(parsed.confidence) || 0.7,
    raw_ai_response: rawContent,
  };

  return validateExtraction(normalized);
};

const extractWithOpenRouter = async (
  fileBuffer,
  mimeType = 'image/jpeg',
  ocrText = ''
) => {
  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    throw new Error('Missing OpenRouter configuration');
  }

  if (isPdf(mimeType)) {
    throw new Error('OpenRouter is skipped for PDF receipts');
  }

  const base64Image = await toBase64Image(fileBuffer, mimeType);

  const response = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_APP_URL
          ? { 'HTTP-Referer': process.env.OPENROUTER_APP_URL }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { 'X-Title': process.env.OPENROUTER_APP_NAME }
          : {}),
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildReceiptPrompt(ocrText),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
        response_format: {
          type: 'json_object',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `OpenRouter API Error: ${await response.text()}`
    );
  }

  const data = await response.json();

  const rawContent =
    data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('Empty OpenRouter response');
  }

  return normalizeExtraction(
    parseAIResponse(rawContent),
    rawContent
  );
};

const extractWithGemini = async (
  fileBuffer,
  mimeType = 'image/jpeg',
  ocrText = '',
  model = GEMINI_MODEL
) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const base64Image = await toBase64Image(fileBuffer, mimeType);

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildReceiptPrompt(ocrText),
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${await response.text()}`);
  }

  const data = await response.json();

  const rawContent =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawContent) {
    throw new Error('Empty Gemini response');
  }

  return normalizeExtraction(
    parseAIResponse(rawContent),
    rawContent
  );
};

const runWithRetry = async (label, handler) => {
  let lastError;

  for (let attempt = 0; attempt <= AI_RETRIES; attempt += 1) {
    try {
      return await handler();
    } catch (error) {
      lastError = error;

      if (attempt < AI_RETRIES) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw new Error(
    `${label} failed: ${getErrorMessage(lastError)}`
  );
};

const extractWithContext = async (
  fileBuffer,
  ocrText = '',
  mimeType = 'image/jpeg'
) => {
  const providers = [];

  if (OPENROUTER_API_KEY && OPENROUTER_MODEL && !isPdf(mimeType)) {
    providers.push({
      name: 'OpenRouter',
      run: () =>
        runWithRetry('OpenRouter', () =>
          extractWithOpenRouter(fileBuffer, mimeType, ocrText)
        ),
    });
  }

  if (GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      run: () =>
        runWithRetry('Gemini', () =>
          extractWithGemini(
            fileBuffer,
            mimeType,
            ocrText,
            GEMINI_MODEL
          )
        ),
    });

    if (GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) {
      providers.push({
        name: 'Gemini fallback',
        run: () =>
          runWithRetry('Gemini fallback', () =>
            extractWithGemini(
              fileBuffer,
              mimeType,
              ocrText,
              GEMINI_FALLBACK_MODEL
            )
          ),
      });
    }
  }

  if (providers.length === 0) {
    throw new Error(
      'No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.'
    );
  }

  let lastError;

  for (const provider of providers) {
    try {
      return await provider.run();
    } catch (error) {
      lastError = error;
      console.error(
        `AI provider failed (${provider.name}):`,
        getErrorMessage(error)
      );
    }
  }

  throw lastError;
};

module.exports = {
  extractWithContext,
};

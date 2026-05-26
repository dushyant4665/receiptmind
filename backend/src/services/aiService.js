require('dotenv').config({ override: true });

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

const extractWithContext = async (fileBuffer, mimeType = 'image/jpeg') => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENAI_API_KEY;

  if (!openRouterKey && !geminiKey) {
    throw new Error('No AI provider configured');
  }

  const base64File = toBase64(fileBuffer);
  let lastError = null;

  if (openRouterKey) {
    for (const modelName of OPENROUTER_MODEL_CANDIDATES) {
      try {
        console.log(`Attempting OpenRouter extraction with model ${modelName}...`);
        const result = await extractWithOpenRouter(openRouterKey, modelName, base64File, mimeType);
        return finalizeExtraction(result, 'openrouter', modelName);
      } catch (error) {
        console.warn(`OpenRouter model ${modelName} failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  if (geminiKey) {
    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        console.log(`Attempting Gemini extraction with model ${modelName}...`);
        const result = await extractWithGemini(geminiKey, modelName, base64File, mimeType);
        return finalizeExtraction(result, 'gemini', modelName);
      } catch (error) {
        console.warn(`Gemini model ${modelName} failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  throw lastError || new Error('All Gemini extraction attempts failed');
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
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const contentText = data?.choices?.[0]?.message?.content;
  if (!contentText) {
    throw new Error('Empty response from OpenRouter');
  }

  return parseExtractionJSON(contentText);
};

const extractWithGemini = async (apiKey, modelName, base64File, mimeType) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const parts = [{ text: buildPrompt(mimeType) }];

  if (mimeType !== 'application/pdf') {
    parts.push({
      inlineData: {
        mimeType,
        data: base64File,
      },
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.05,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const contentText = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (!contentText) {
    throw new Error('Empty response from Gemini');
  }

  return parseExtractionJSON(contentText);
};

const buildPrompt = (mimeType) => `Extract structured accounting data from this uploaded receipt, invoice, or bill.
Return only valid JSON with this exact schema:
{
  "invoice_number": "",
  "invoice_date": "",
  "due_date": "",
  "vendor_name": "",
  "vendor_gstin": "",
  "buyer_name": "",
  "buyer_gstin": "",
  "amount": 0,
  "subtotal": 0,
  "tax_amount": 0,
  "currency": "",
  "payment_terms": "",
  "po_number": "",
  "category": "",
  "confidence": 0
}

Rules:
- Use only what is visible in the uploaded document.
- Normalize dates as YYYY-MM-DD.
- amount must be the final payable total.
- confidence must be between 0 and 1.
- If a field is missing, return empty string or 0.

Document type: ${mimeType}`;

const finalizeExtraction = (result, providerName, modelName) => {
  const normalized = normalizeExtraction(result);
  normalized.provider = providerName;
  normalized.model = modelName;
  normalized.raw_text = '';
  normalized.ai_output = {
    provider: providerName,
    model: modelName,
    fields: {
      invoice_number: normalized.invoice_number,
      invoice_date: normalized.invoice_date,
      receipt_date: normalized.receipt_date,
      due_date: normalized.due_date,
      vendor_name: normalized.vendor_name,
      vendor_gstin: normalized.vendor_gstin,
      buyer_name: normalized.buyer_name,
      buyer_gstin: normalized.buyer_gstin,
      amount: normalized.amount,
      subtotal: normalized.subtotal,
      tax_amount: normalized.tax_amount,
      currency: normalized.currency,
      payment_terms: normalized.payment_terms,
      po_number: normalized.po_number,
      category: normalized.category,
      confidence: normalized.confidence,
    },
  };
  return normalized;
};

const parseExtractionJSON = (content) => {
  const clean = stripCodeFences(content.trim());

  try {
    return mapRawExtraction(JSON.parse(clean));
  } catch (error) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Failed to parse AI response: ${content.substring(0, 200)}`);
    }
    return mapRawExtraction(JSON.parse(match[0]));
  }
};

const mapRawExtraction = (raw) => ({
  invoice_number: stringValue(raw.invoice_number || raw.invoice_no || raw.bill_number),
  invoice_date: stringValue(raw.invoice_date || raw.date),
  receipt_date: stringValue(raw.receipt_date || raw.invoice_date || raw.date),
  due_date: stringValue(raw.due_date),
  vendor_name: stringValue(raw.vendor_name || raw.seller_name || raw.merchant_name),
  vendor_gstin: stringValue(raw.vendor_gstin || raw.gstin || raw.seller_gstin),
  buyer_name: stringValue(raw.buyer_name || raw.customer_name),
  buyer_gstin: stringValue(raw.buyer_gstin || raw.customer_gstin),
  amount: numberValue(raw.amount ?? raw.invoice_total ?? raw.total ?? raw.grand_total),
  subtotal: numberValue(raw.subtotal ?? raw.sub_total ?? raw.taxable_amount),
  tax_amount: numberValue(raw.tax_amount ?? raw.tax ?? raw.gst_amount),
  currency: stringValue(raw.currency),
  payment_terms: stringValue(raw.payment_terms),
  po_number: stringValue(raw.po_number || raw.po || raw.purchase_order),
  category: stringValue(raw.category),
  confidence: numberValue(raw.confidence),
});

const normalizeExtraction = (result) => {
  const normalized = {
    invoice_number: cleanInlineText(result.invoice_number),
    invoice_date: normalizeDate(result.invoice_date),
    receipt_date: normalizeDate(result.receipt_date || result.invoice_date),
    due_date: normalizeDate(result.due_date),
    vendor_name: cleanInlineText(result.vendor_name),
    vendor_gstin: cleanInlineText(result.vendor_gstin),
    buyer_name: cleanInlineText(result.buyer_name),
    buyer_gstin: cleanInlineText(result.buyer_gstin),
    amount: roundMoney(result.amount),
    subtotal: roundMoney(result.subtotal),
    tax_amount: roundMoney(result.tax_amount),
    currency: cleanInlineText(result.currency).toUpperCase() || 'USD',
    payment_terms: cleanInlineText(result.payment_terms),
    po_number: cleanInlineText(result.po_number),
    category: cleanInlineText(result.category) || DEFAULT_CATEGORY,
    confidence: normalizeConfidence(result.confidence),
  };

  if (!normalized.amount && normalized.subtotal && normalized.tax_amount) {
    normalized.amount = roundMoney(normalized.subtotal + normalized.tax_amount);
  }

  if (!normalized.subtotal && normalized.amount && normalized.tax_amount && normalized.amount >= normalized.tax_amount) {
    normalized.subtotal = roundMoney(normalized.amount - normalized.tax_amount);
  }

  if (!normalized.confidence && normalized.vendor_name && normalized.amount > 0 && normalized.receipt_date) {
    normalized.confidence = 0.9;
  }

  return normalized;
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parts = trimmed.split(/[\/\-.]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) return '';

  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  if (parts[2].length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return '';

    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${parts[2]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return '';
};

const stripCodeFences = (text) => text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

const toBase64 = (fileBuffer) => {
  if (Buffer.isBuffer(fileBuffer)) return fileBuffer.toString('base64');
  if (typeof fileBuffer === 'string') return fileBuffer;
  throw new Error('Invalid file data provided');
};

const stringValue = (value) => (value === null || value === undefined ? '' : String(value));

const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const roundMoney = (value) => Number(numberValue(value).toFixed(2));

const normalizeConfidence = (value) => {
  const numeric = numberValue(value);
  if (numeric <= 0) return 0;
  if (numeric > 1 && numeric <= 100) return Number((numeric / 100).toFixed(2));
  return Math.min(1, Number(numeric.toFixed(2)));
};

const cleanInlineText = (value) => stringValue(value).replace(/\s+/g, ' ').trim();

module.exports = {
  extractWithContext,
};

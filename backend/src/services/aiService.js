require('dotenv').config();

const extractWithContext = async (fileBuffer, ocrText = '', mimeType = 'image/jpeg') => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openAIKey) {
    throw new Error('No AI provider configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in .env');
  }

  // Convert buffer to base64
  let base64Image;
  if (Buffer.isBuffer(fileBuffer)) {
    base64Image = fileBuffer.toString('base64');
  } else if (typeof fileBuffer === 'string') {
    base64Image = fileBuffer;
  } else {
    throw new Error('Invalid file data provided');
  }

  let lastError;

  // Try OpenRouter first if key starts with sk-or-v1 (more reliable)
  const isOpenRouter = openAIKey && openAIKey.startsWith('sk-or-v1');

  if (isOpenRouter) {
    try {
      console.log('Attempting OpenRouter extraction...');
      const result = await extractWithOpenRouter(openAIKey, base64Image, mimeType, ocrText);
      return result;
    } catch (error) {
      console.warn('OpenRouter extraction failed:', error.message);
      lastError = error;
    }
  }

  // Try Gemini
  if (geminiKey) {
    const models = [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
    ];

    for (const modelName of models) {
      try {
        console.log(`Attempting Gemini extraction with model ${modelName}...`);
        const result = await extractWithGemini(geminiKey, modelName, base64Image, mimeType, ocrText);
        return result;
      } catch (error) {
        console.warn(`Gemini model ${modelName} failed:`, error.message);
        lastError = error;
        // If quota exhausted, no point trying same-tier models
        if (error.message.includes('429') && models.indexOf(modelName) < 2) {
          console.warn('Quota exhausted on premium models, trying lite models...');
        }
      }
    }
  }

  // Try plain OpenAI as last fallback (if not OpenRouter)
  if (openAIKey && !isOpenRouter) {
    try {
      console.log('Attempting OpenAI extraction...');
      const result = await extractWithOpenAI(openAIKey, base64Image, mimeType, ocrText);
      return result;
    } catch (error) {
      console.warn('OpenAI extraction failed:', error.message);
      lastError = error;
    }
  }

  throw lastError || new Error('All AI extraction attempts failed');
};

const extractWithOpenRouter = async (apiKey, base64Image, mimeType, ocrText) => {
  const models = [
    'google/gemini-2.0-flash-001',
    'google/gemini-2.5-flash-preview',
    'google/gemini-flash-1.5',
    'openai/gpt-4o-mini',
  ];

  let lastErr;
  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'ReceiptMind',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: buildPrompt(ocrText),
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
          response_format: { type: 'json_object' },
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('Empty response from OpenRouter');
      }

      const contentText = data.choices[0].message.content;
      const result = parseExtractionJSON(contentText);
      normalizeExtraction(result);
      result.raw_text = ocrText;
      result.ai_output = contentText;
      console.log(`OpenRouter extraction succeeded with model ${model}`);
      return result;
    } catch (err) {
      console.warn(`OpenRouter model ${model} failed:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr;
};

const extractWithGemini = async (apiKey, modelName, base64Image, mimeType, ocrText) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // For PDF files, Gemini cannot inline PDFs — convert to description
  const parts = mimeType === 'application/pdf'
    ? [{ text: buildPrompt(ocrText) + '\n\nNote: This is a PDF receipt. Use the OCR text above for extraction.' }]
    : [
        { text: buildPrompt(ocrText) },
        { inlineData: { mimeType: mimeType, data: base64Image } },
      ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Empty response from Gemini');
  }

  const contentText = data.candidates[0].content.parts[0].text;
  const result = parseExtractionJSON(contentText);
  normalizeExtraction(result);
  result.raw_text = ocrText;
  result.ai_output = contentText;
  return result;
};

const extractWithOpenAI = async (apiKey, base64Image, mimeType, ocrText) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(ocrText) },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const contentText = data.choices[0].message.content;
  const result = parseExtractionJSON(contentText);
  normalizeExtraction(result);
  result.raw_text = ocrText;
  result.ai_output = contentText;
  return result;
};

const buildPrompt = (ocrText) => `Extract structured data from this receipt image.
${ocrText ? `\nOCR Text for context:\n${ocrText}\n` : ''}

IMPORTANT:
- invoice_number (string) if present
- invoice_date (YYYY-MM-DD) if present
- due_date (YYYY-MM-DD) if present
- vendor_name (string)
- vendor_gstin (string)
- buyer_name (string)
- buyer_gstin (string)
- invoice_total (number) final total paid
- subtotal (number)
- tax_amount (number)
- currency (string, e.g., INR, USD)
- payment_terms (string)
- po_number (string)
- confidence (0.0 to 1.0 indicating extraction certainty)`;const parseExtractionJSON = (content) => {
  let clean = content.trim();
  // Remove markdown code blocks if present
  clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const raw = JSON.parse(clean);
    return {
      invoice_number: stringValue(raw.invoice_number),
      invoice_date: stringValue(raw.invoice_date),
      due_date: stringValue(raw.due_date),
      vendor_name: stringValue(raw.vendor_name),
      vendor_gstin: stringValue(raw.vendor_gstin),
      buyer_name: stringValue(raw.buyer_name),
      buyer_gstin: stringValue(raw.buyer_gstin),
      invoice_total: numberValue(raw.invoice_total),
      subtotal: numberValue(raw.subtotal),
      tax_amount: numberValue(raw.tax_amount),
      currency: stringValue(raw.currency),
      payment_terms: stringValue(raw.payment_terms),
      po_number: stringValue(raw.po_number),
      category: stringValue(raw.category),
      confidence: numberValue(raw.confidence)
    };
  } catch (e) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      const raw = JSON.parse(match[0]);
      return {
        invoice_number: stringValue(raw.invoice_number),
        invoice_date: stringValue(raw.invoice_date),
        due_date: stringValue(raw.due_date),
        vendor_name: stringValue(raw.vendor_name),
        vendor_gstin: stringValue(raw.vendor_gstin),
        buyer_name: stringValue(raw.buyer_name),
        buyer_gstin: stringValue(raw.buyer_gstin),
        invoice_total: numberValue(raw.invoice_total),
        subtotal: numberValue(raw.subtotal),
        tax_amount: numberValue(raw.tax_amount),
        currency: stringValue(raw.currency),
        payment_terms: stringValue(raw.payment_terms),
        po_number: stringValue(raw.po_number),
        category: stringValue(raw.category),
        confidence: numberValue(raw.confidence)
      };
    }
    throw new Error(`Failed to parse AI response: ${content.substring(0, 200)}`);
  }
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return null;
  dateStr = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      [y, m, d] = parts;
    } else if (parts[2].length === 4) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      y = parts[2];
      if (p0 > 12) { d = String(p0).padStart(2, '0'); m = String(p1).padStart(2, '0'); }
      else if (p1 > 12) { m = String(p0).padStart(2, '0'); d = String(p1).padStart(2, '0'); }
      else { d = String(p0).padStart(2, '0'); m = String(p1).padStart(2, '0'); }
    }
    if (y && m && d) return `${y}-${m}-${d}`;
  }
  return null;
};

const normalizeExtraction = (result) => {
  result.vendor_name = (result.vendor_name || '').trim();
  result.vendor_gstin = (result.vendor_gstin || '').trim();
  result.buyer_name = (result.buyer_name || '').trim();
  result.buyer_gstin = (result.buyer_gstin || '').trim();
  result.category = (result.category || 'General').trim();

  // Normalize dates
  result.receipt_date = normalizeDate(result.receipt_date);
  result.invoice_date = normalizeDate(result.invoice_date);
  result.due_date = normalizeDate(result.due_date);

  if (result.confidence < 0) result.confidence = 0;
  if (result.confidence > 1) result.confidence = 1;
  if (!result.confidence && result.vendor_name && result.invoice_total > 0) {
    result.confidence = 0.65;
  }
};

const stringValue = (v) => {
  if (v === null || v === undefined) return '';
  return String(v);
};

const numberValue = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const clean = v.replace(/,/g, '').replace(/^\$/, '').trim();
    const f = parseFloat(clean);
    return isNaN(f) ? 0 : f;
  }
  return 0;
};

module.exports = { extractWithContext };

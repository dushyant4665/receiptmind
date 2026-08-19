require('dotenv').config();
const axios = require('axios');
const { env } = require('../config/env');
const { sleep, retryDelay } = require('../lib/retry');

const isRetryableError = (err) => {
  if (!axios.isAxiosError(err)) return false;
  if (!err.response) return true;
  return [408, 429, 500, 502, 503, 504].includes(err.response.status);
};

const normalizeMessages = (body) => {
  if (body.messages && body.messages.length > 0) return body.messages;
  const prompt = (body.prompt || '').trim();
  if (!prompt) throw new Error('prompt or messages are required');
  return [{ role: 'user', content: prompt }];
};

// 1. Mistral API Call
const callMistral = async (messages, body) => {
  if (!env.mistralApiKey) throw new Error('Missing MISTRAL_API_KEY');

  const response = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    {
      model: env.mistralModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: body.temperature ?? 0,
      response_format: { type: 'json_object' },
      ...(typeof body.maxTokens === 'number' ? { max_tokens: body.maxTokens } : {}),
    },
    {
      timeout: env.timeoutMs,
      headers: {
        Authorization: `Bearer ${env.mistralApiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty Mistral response');

  return {
    provider: 'mistral',
    model: env.mistralModel,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    raw: response.data,
  };
};

// 2. Google Gemini Call
const callGemini = async (messages, model, body) => {
  if (!env.geminiApiKey) throw new Error('Missing GEMINI_API_KEY');

  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const payload = {
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
    contents: chatMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: body.temperature ?? 0,
      responseMimeType: 'application/json',
      ...(typeof body.maxTokens === 'number' ? { maxOutputTokens: body.maxTokens } : {}),
    },
  };

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
    payload,
    { timeout: env.timeoutMs, headers: { 'Content-Type': 'application/json' } }
  );

  const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty Gemini response');

  return { provider: 'gemini', model, content, raw: response.data };
};

// Retry wrapper
const withRetry = async (fn) => {
  let lastErr;
  for (let attempt = 0; attempt <= env.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < env.maxRetries && isRetryableError(err)) {
        await sleep(retryDelay(attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

// Generate response with automated failover
const generateWithFailover = async (body) => {
  const messages = normalizeMessages(body);
  const start = Date.now();
  const pref = body.provider || 'auto';

  const chain = pref === 'gemini'
    ? [
        () => callGemini(messages, env.geminiModel, body),
        () => callMistral(messages, body),
        () => callGemini(messages, env.geminiFallbackModel, body),
      ]
    : [
        () => callMistral(messages, body),
        () => callGemini(messages, env.geminiModel, body),
        () => callGemini(messages, env.geminiFallbackModel, body),
      ];

  let attempts = 0;
  let lastError;

  for (const callProvider of chain) {
    try {
      attempts++;
      const result = await withRetry(callProvider);
      return {
        ...result,
        attempts,
        latencyMs: Date.now() - start,
        fallbackUsed: attempts > 1,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All AI providers failed');
};

module.exports = { generateWithFailover };

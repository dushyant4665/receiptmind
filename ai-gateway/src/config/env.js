require('dotenv').config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  port: toNumber(process.env.PORT, 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  timeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 45000),
  maxRetries: Math.max(0, toNumber(process.env.AI_MAX_RETRIES, 1)),
  mistralApiKey: process.env.MISTRAL_API_KEY || 'VHc9KgTIhHBVVfVUiEG9d8nqShSoqrDk',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001',
};

module.exports = { env };

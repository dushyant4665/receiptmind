import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: toNumber(process.env.PORT, 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  timeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 45000),
  maxRetries: Math.max(0, toNumber(process.env.AI_MAX_RETRIES, 1)),
  openRouterApiKey:
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '',
  openRouterModel:
    process.env.OPENROUTER_MODEL ||
    process.env.OPENAI_MODEL ||
    'google/gemini-2.0-flash-001',
  openRouterAppName:
    process.env.OPENROUTER_APP_NAME || 'ReceiptMind AI Gateway',
  openRouterAppUrl:
    process.env.OPENROUTER_APP_URL || 'http://localhost:4100',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  geminiFallbackModel:
    process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001',
};

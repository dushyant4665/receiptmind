"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.env = {
    port: toNumber(process.env.PORT, 4100),
    nodeEnv: process.env.NODE_ENV || 'development',
    timeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 45000),
    maxRetries: Math.max(0, toNumber(process.env.AI_MAX_RETRIES, 1)),
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
    openRouterAppName: process.env.OPENROUTER_APP_NAME || 'ReceiptMind AI Gateway',
    openRouterAppUrl: process.env.OPENROUTER_APP_URL || 'http://localhost:4100',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001',
};

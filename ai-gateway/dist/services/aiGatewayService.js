"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithFailover = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const retry_1 = require("../lib/retry");
const isRetryableError = (error) => {
    if (!axios_1.default.isAxiosError(error))
        return false;
    if (!error.response)
        return true;
    return [408, 429, 500, 502, 503, 504].includes(error.response.status);
};
const normalizeMessages = (body) => {
    if (body.messages?.length)
        return body.messages;
    const prompt = body.prompt?.trim();
    if (!prompt)
        throw new Error('prompt or messages are required');
    return [{ role: 'user', content: prompt }];
};
// Call OpenRouter
const callOpenRouter = async (messages, body) => {
    if (!env_1.env.openRouterApiKey)
        throw new Error('Missing OPENROUTER_API_KEY');
    const response = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
        model: env_1.env.openRouterModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: body.temperature ?? 0,
        ...(typeof body.maxTokens === 'number' ? { max_tokens: body.maxTokens } : {}),
    }, {
        timeout: env_1.env.timeoutMs,
        headers: {
            Authorization: `Bearer ${env_1.env.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env_1.env.openRouterAppUrl,
            'X-Title': env_1.env.openRouterAppName,
        },
    });
    const content = response.data?.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Empty OpenRouter response');
    return {
        provider: 'openrouter',
        model: env_1.env.openRouterModel,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        raw: response.data,
    };
};
// Call Gemini
const callGemini = async (messages, model, body) => {
    if (!env_1.env.geminiApiKey)
        throw new Error('Missing GEMINI_API_KEY');
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
            ...(typeof body.maxTokens === 'number' ? { maxOutputTokens: body.maxTokens } : {}),
        },
    };
    const response = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env_1.env.geminiApiKey}`, payload, { timeout: env_1.env.timeoutMs, headers: { 'Content-Type': 'application/json' } });
    const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content)
        throw new Error('Empty Gemini response');
    return {
        provider: 'gemini',
        model,
        content,
        raw: response.data,
    };
};
// Execute operation with retry
const withRetry = async (fn) => {
    let lastErr;
    for (let attempt = 0; attempt <= env_1.env.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (attempt < env_1.env.maxRetries && isRetryableError(err)) {
                await (0, retry_1.sleep)((0, retry_1.retryDelay)(attempt));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
};
// Generate response with automated provider failover
const generateWithFailover = async (body) => {
    const messages = normalizeMessages(body);
    const start = Date.now();
    const pref = body.provider || 'auto';
    const chain = pref === 'gemini'
        ? [
            () => callGemini(messages, env_1.env.geminiModel, body),
            () => callOpenRouter(messages, body),
            () => callGemini(messages, env_1.env.geminiFallbackModel, body),
        ]
        : [
            () => callOpenRouter(messages, body),
            () => callGemini(messages, env_1.env.geminiModel, body),
            () => callGemini(messages, env_1.env.geminiFallbackModel, body),
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
        }
        catch (err) {
            lastError = err;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('All AI providers failed');
};
exports.generateWithFailover = generateWithFailover;

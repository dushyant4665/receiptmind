"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const zod_1 = require("zod");
const env_1 = require("./config/env");
const aiGatewayService_1 = require("./services/aiGatewayService");
const chatMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['system', 'user', 'assistant']),
    content: zod_1.z.string().min(1),
});
const generateSchema = zod_1.z
    .object({
    prompt: zod_1.z.string().min(1).optional(),
    messages: zod_1.z.array(chatMessageSchema).min(1).optional(),
    provider: zod_1.z.enum(['auto', 'openrouter', 'gemini']).optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    maxTokens: zod_1.z.number().int().positive().optional(),
})
    .refine((value) => Boolean(value.prompt?.trim() || value.messages?.length), 'prompt or messages are required');
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use((0, morgan_1.default)('dev'));
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'AI Gateway healthy',
        data: {
            providers: {
                openrouter: Boolean(env_1.env.openRouterApiKey),
                gemini: Boolean(env_1.env.geminiApiKey),
            },
            timeout_ms: env_1.env.timeoutMs,
            retries: env_1.env.maxRetries,
        },
    });
});
app.post('/api/generate', async (req, res, next) => {
    try {
        const body = generateSchema.parse(req.body);
        const result = await (0, aiGatewayService_1.generateWithFailover)(body);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: 'Route not found',
        },
    });
});
app.use((error, req, res, next) => {
    if (error instanceof zod_1.z.ZodError) {
        res.status(400).json({
            success: false,
            error: {
                message: 'Invalid request body',
                details: error.flatten(),
            },
        });
        return;
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
        success: false,
        error: {
            message,
        },
    });
});
exports.default = app;

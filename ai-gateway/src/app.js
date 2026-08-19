require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { z } = require('zod');
const { env } = require('./config/env');
const { generateWithFailover } = require('./services/aiGatewayService');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Validate incoming request shape
const generateSchema = z
  .object({
    prompt: z.string().min(1).optional(),
    messages: z
      .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1) }))
      .min(1)
      .optional(),
    provider: z.enum(['auto', 'openrouter', 'gemini']).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  })
  .refine(
    (val) => Boolean(val.prompt?.trim() || val.messages?.length),
    'prompt or messages are required'
  );

// Health check — shows which API keys are configured
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Gateway healthy',
    data: {
      providers: {
        openrouter: Boolean(env.openRouterApiKey),
        gemini: Boolean(env.geminiApiKey),
      },
      timeout_ms: env.timeoutMs,
      retries: env.maxRetries,
    },
  });
});

// Main generation endpoint
app.post('/api/generate', async (req, res, next) => {
  try {
    const body = generateSchema.parse(req.body);
    const result = await generateWithFailover(body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid request body', details: err.flatten() },
    });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ success: false, error: { message } });
});

module.exports = app;

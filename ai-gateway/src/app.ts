import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';

import { env } from './config/env';
import { generateWithFailover } from './services/aiGatewayService';

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});

const generateSchema = z
  .object({
    prompt: z.string().min(1).optional(),
    messages: z.array(chatMessageSchema).min(1).optional(),
    provider: z.enum(['auto', 'openrouter', 'gemini']).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  })
  .refine(
    (value) => Boolean(value.prompt?.trim() || value.messages?.length),
    'prompt or messages are required'
  );

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

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

app.post('/api/generate', async (req, res, next) => {
  try {
    const body = generateSchema.parse(req.body);
    const result = await generateWithFailover(body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
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

app.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
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
  }
);

export default app;

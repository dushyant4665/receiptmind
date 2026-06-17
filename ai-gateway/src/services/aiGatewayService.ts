import axios from 'axios';

import { env } from '../config/env';
import {
  ChatMessage,
  GenerateRequestBody,
  GatewayResponse,
  ProviderResult,
} from '../types';
import { retryDelay, sleep } from '../lib/retry';

type NormalizedMessages = ChatMessage[];

const isRetryableAxiosError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return [408, 429, 500, 502, 503, 504].includes(
    error.response.status
  );
};

const createClient = (baseURL: string, headers: Record<string, string>) =>
  axios.create({
    baseURL,
    timeout: env.timeoutMs,
    headers,
    validateStatus: (status) => status < 400,
  });

const openRouterClient = createClient('https://openrouter.ai', {
  Authorization: `Bearer ${env.openRouterApiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': env.openRouterAppUrl,
  'X-Title': env.openRouterAppName,
});

const geminiClient = createClient(
  'https://generativelanguage.googleapis.com',
  {
    'Content-Type': 'application/json',
  }
);

const normalizeMessages = (body: GenerateRequestBody): NormalizedMessages => {
  if (body.messages?.length) {
    return body.messages;
  }

  const prompt = body.prompt?.trim();

  if (!prompt) {
    throw new Error('prompt or messages are required');
  }

  return [
    {
      role: 'user',
      content: prompt,
    },
  ];
};

const toOpenRouterMessages = (messages: NormalizedMessages) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const toGeminiPayload = (messages: NormalizedMessages) => {
  const systemMessage = messages.find((message) => message.role === 'system');

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: message.content,
        },
      ],
    }));

  return {
    ...(systemMessage
      ? {
          systemInstruction: {
            parts: [
              {
                text: systemMessage.content,
              },
            ],
          },
        }
      : {}),
    contents,
    generationConfig: {
      temperature: 0,
    },
  };
};

const extractOpenRouterContent = (data: any) => {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }

  throw new Error('Empty OpenRouter response');
};

const extractGeminiContent = (data: any) => {
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty Gemini response');
  }

  return content;
};

const callWithRetry = async <T>(
  label: string,
  operation: () => Promise<T>
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= env.maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < env.maxRetries && isRetryableAxiosError(error)) {
        await sleep(retryDelay(attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? new Error(`${label} failed: ${lastError.message}`)
    : new Error(`${label} failed`);
};

const callOpenRouter = async (
  messages: NormalizedMessages,
  body: GenerateRequestBody
): Promise<ProviderResult> => {
  if (!env.openRouterApiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const response = await openRouterClient.post('/api/v1/chat/completions', {
    model: env.openRouterModel,
    messages: toOpenRouterMessages(messages),
    temperature: body.temperature ?? 0,
    ...(typeof body.maxTokens === 'number'
      ? { max_tokens: body.maxTokens }
      : {}),
  });

  const content = extractOpenRouterContent(response.data);

  return {
    provider: 'openrouter',
    model: env.openRouterModel,
    content,
    raw: response.data,
  };
};

const callGemini = async (
  messages: NormalizedMessages,
  model: string,
  body: GenerateRequestBody
): Promise<ProviderResult> => {
  if (!env.geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const response = await geminiClient.post(
    `/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
    {
      ...toGeminiPayload(messages),
      generationConfig: {
        temperature: body.temperature ?? 0,
        ...(typeof body.maxTokens === 'number'
          ? { maxOutputTokens: body.maxTokens }
          : {}),
      },
    }
  );

  const content = extractGeminiContent(response.data);

  return {
    provider: 'gemini',
    model,
    content,
    raw: response.data,
  };
};

const runProviderChain = async (
  providers: Array<() => Promise<ProviderResult>>
) => {
  let lastError: unknown;
  let attempts = 0;

  for (const provider of providers) {
    try {
      attempts += 1;
      const result = await callWithRetry('provider', provider);
      return {
        result,
        attempts,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All AI providers failed');
};

export const generateWithFailover = async (
  body: GenerateRequestBody
): Promise<GatewayResponse> => {
  const messages = normalizeMessages(body);
  const startedAt = Date.now();
  const providerPreference = body.provider || 'auto';
  const providerChainOrder =
    providerPreference === 'openrouter'
      ? ['openrouter', 'gemini', 'gemini-fallback']
      : providerPreference === 'gemini'
        ? ['gemini', 'openrouter', 'gemini-fallback']
        : ['openrouter', 'gemini', 'gemini-fallback'];

  const providerChain =
    providerPreference === 'openrouter'
      ? [
          () => callOpenRouter(messages, body),
          () => callGemini(messages, env.geminiModel, body),
          () => callGemini(messages, env.geminiFallbackModel, body),
        ]
      : providerPreference === 'gemini'
        ? [
            () => callGemini(messages, env.geminiModel, body),
            () => callOpenRouter(messages, body),
            () => callGemini(messages, env.geminiFallbackModel, body),
          ]
        : [
            () => callOpenRouter(messages, body),
            () => callGemini(messages, env.geminiModel, body),
            () => callGemini(messages, env.geminiFallbackModel, body),
        ];

  const { result, attempts } = await runProviderChain(providerChain);

  return {
    ...result,
    attempts,
    latencyMs: Date.now() - startedAt,
    fallbackUsed:
      providerChainOrder[0] !== result.provider ||
      (providerPreference === 'auto' && result.provider !== 'openrouter'),
  };
};

export type ProviderName = 'openrouter' | 'gemini';

export type ProviderPreference = 'auto' | ProviderName;

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateRequestBody {
  prompt?: string;
  messages?: ChatMessage[];
  provider?: ProviderPreference;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResult {
  provider: ProviderName;
  model: string;
  content: string;
  raw: unknown;
}

export interface GatewayResponse extends ProviderResult {
  attempts: number;
  latencyMs: number;
  fallbackUsed: boolean;
}

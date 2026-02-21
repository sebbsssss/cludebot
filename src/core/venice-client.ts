import { createChildLogger } from './logger';

const log = createChildLogger('venice');

// ============================================================
// VENICE CLIENT — Permissionless, Private LLM Inference
//
// Venice provides:
// - OpenAI-compatible API
// - No data retention (prompts stay private)
// - Permissionless access (no approval needed)
// - Multiple model access (Claude, GPT, open-source)
//
// This aligns with Clude's decentralization philosophy:
// - Memory: Solana (decentralized)
// - Inference: Venice (permissionless)
// ============================================================

const VENICE_API_URL = 'https://api.venice.ai/api/v1';

export interface VeniceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VeniceResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Available Venice models (subset - they support many more)
export const VENICE_MODELS = {
  // Reasoning
  'deepseek-r1': 'deepseek-ai-DeepSeek-R1',
  'qwen-reasoning': 'zai-org-glm-4.7-reasoning',
  
  // General
  'llama-70b': 'llama-3.3-70b',
  'qwen-235b': 'qwen3-235b-a22b',
  'glm-4': 'zai-org-glm-4.7',
  
  // Fast
  'llama-8b': 'llama-3.1-8b',
  'qwen-4b': 'qwen3-4b',
  
  // Uncensored
  'venice-uncensored': 'venice-uncensored-1.1',
} as const;

export type VeniceModelAlias = keyof typeof VENICE_MODELS;

let config: VeniceConfig | null = null;

export function initVenice(cfg: VeniceConfig): void {
  config = {
    ...cfg,
    model: cfg.model || VENICE_MODELS['llama-70b'],
    maxTokens: cfg.maxTokens || 2000,
  };
  log.info({ model: config.model }, 'Venice client initialized');
}

export function isVeniceEnabled(): boolean {
  return config !== null && !!config.apiKey;
}

export function getVeniceConfig(): VeniceConfig | null {
  return config;
}

/**
 * Generate a response using Venice's permissionless LLM API.
 * OpenAI-compatible format.
 */
export async function generateVeniceResponse(opts: {
  messages: VeniceMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}): Promise<string> {
  if (!config?.apiKey) {
    throw new Error('Venice client not initialized');
  }

  const messages: VeniceMessage[] = [];
  
  // Add system prompt if provided
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }
  
  messages.push(...opts.messages);

  const model = opts.model || config.model || VENICE_MODELS['llama-70b'];
  const maxTokens = opts.maxTokens || config.maxTokens || 2000;

  try {
    const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: opts.temperature ?? 0.7,
        // Claude models on Venice require thinking config
        ...(model.startsWith('claude') && {
          thinking: {
            type: 'enabled',
            budget_tokens: 2048,
          },
        }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'Venice API error');
      throw new Error(`Venice API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as VeniceResponse;
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid Venice response format');
    }

    log.debug({
      model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    }, 'Venice response generated');

    return data.choices[0].message.content;
  } catch (err) {
    log.error({ err, model }, 'Venice request failed');
    throw err;
  }
}

/**
 * Generate a response with web search enabled.
 * Venice can search the web and include citations.
 */
export async function generateVeniceResponseWithSearch(opts: {
  messages: VeniceMessage[];
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}): Promise<{ content: string; citations?: string[] }> {
  if (!config?.apiKey) {
    throw new Error('Venice client not initialized');
  }

  const messages: VeniceMessage[] = [];
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }
  messages.push(...opts.messages);

  const model = opts.model || config.model || VENICE_MODELS['llama-70b'];

  try {
    const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens || 2000,
        venice_parameters: {
          enable_web_search: 'on',
          enable_web_citations: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Venice API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as VeniceResponse;
    const content = data.choices[0]?.message?.content || '';

    // Extract citations if present (Venice includes them in the response)
    const citationMatches = content.match(/\[(\d+)\]\s*(https?:\/\/[^\s\]]+)/g);
    const citations = citationMatches?.map(m => m.replace(/\[\d+\]\s*/, ''));

    return { content, citations };
  } catch (err) {
    log.error({ err }, 'Venice web search request failed');
    throw err;
  }
}

/**
 * Simple helper for single-turn generation.
 */
export async function askVenice(
  prompt: string,
  opts?: {
    model?: string;
    systemPrompt?: string;
    maxTokens?: number;
  }
): Promise<string> {
  return generateVeniceResponse({
    messages: [{ role: 'user', content: prompt }],
    ...opts,
  });
}

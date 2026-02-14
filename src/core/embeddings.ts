import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('embeddings');

// ============================================================
// PLUGGABLE EMBEDDING SYSTEM
//
// Supports multiple providers (Voyage AI, OpenAI-compatible) via
// plain fetch — no SDK dependencies. Gracefully disabled when
// no provider is configured; all callers fall back to keyword scoring.
//
// Provider API contracts:
//   POST /embeddings  { input: string | string[], model: string }
//   → { data: [{ embedding: number[], index: number }] }
// ============================================================

interface ProviderConfig {
  url: string;
  defaultModel: string;
  authHeader: (key: string) => string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  voyage: {
    url: 'https://api.voyageai.com/v1/embeddings',
    defaultModel: 'voyage-3-lite',
    authHeader: (key) => `Bearer ${key}`,
  },
  openai: {
    url: 'https://api.openai.com/v1/embeddings',
    defaultModel: 'text-embedding-3-small',
    authHeader: (key) => `Bearer ${key}`,
  },
};

let _enabled: boolean | null = null;

export function isEmbeddingEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  const provider = config.embedding.provider;
  _enabled = !!provider && !!config.embedding.apiKey && provider in PROVIDERS;
  if (_enabled) {
    log.info({ provider }, 'Embedding system enabled');
  }
  return _enabled;
}

/**
 * Generate a single embedding vector for the given text.
 * Returns null if embeddings are disabled or the API call fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isEmbeddingEnabled()) return null;

  const provider = config.embedding.provider;
  if (!provider || !(provider in PROVIDERS)) return null;

  const providerConfig = PROVIDERS[provider];
  const model = config.embedding.model || providerConfig.defaultModel;

  try {
    const res = await fetch(providerConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': providerConfig.authHeader(config.embedding.apiKey),
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model,
        ...(provider === 'openai' ? { dimensions: config.embedding.dimensions } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      log.error({ status: res.status, body: errText.slice(0, 200) }, 'Embedding API error');
      return null;
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    log.error({ err }, 'Embedding generation failed');
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in a single batch API call.
 * More efficient than calling generateEmbedding() in a loop.
 * Returns an array matching input length; null for any that failed.
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!isEmbeddingEnabled() || texts.length === 0) return texts.map(() => null);

  const provider = config.embedding.provider;
  if (!provider || !(provider in PROVIDERS)) return texts.map(() => null);

  const providerConfig = PROVIDERS[provider];
  const model = config.embedding.model || providerConfig.defaultModel;

  try {
    const res = await fetch(providerConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': providerConfig.authHeader(config.embedding.apiKey),
      },
      body: JSON.stringify({
        input: texts.map(t => t.slice(0, 8000)),
        model,
        ...(provider === 'openai' ? { dimensions: config.embedding.dimensions } : {}),
      }),
    });

    if (!res.ok) {
      log.error({ status: res.status }, 'Batch embedding API error');
      return texts.map(() => null);
    }

    const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
    const result: (number[] | null)[] = texts.map(() => null);
    for (const item of data.data || []) {
      result[item.index] = item.embedding;
    }
    return result;
  } catch (err) {
    log.error({ err }, 'Batch embedding generation failed');
    return texts.map(() => null);
  }
}

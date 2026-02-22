import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { createChildLogger } from './logger';
import { checkOutput } from './guardrails';

const log = createChildLogger('claude-client');

// ── Pluggable system prompt & post-processor ──
// Defaults are generic SDK prompts. The bot wires in its personality at startup.
let _systemPromptProvider: () => string = () => 'You are an AI assistant with persistent memory.';
let _responsePostProcessor: (text: string) => string = (t) => t;

/** @internal Bot injects its personality (base-prompt.ts) here at startup. */
export function _setSystemPromptProvider(fn: () => string): void {
  _systemPromptProvider = fn;
}

/** @internal Bot injects its closer logic here at startup. */
export function _setResponsePostProcessor(fn: (text: string) => string): void {
  _responsePostProcessor = fn;
}

let anthropic: Anthropic;
try {
  anthropic = new Anthropic({ apiKey: config.anthropic.apiKey || 'placeholder' });
} catch {
  anthropic = null as unknown as Anthropic;
}

let _anthropicOverride: Anthropic | null = null;
let _modelOverride: string | null = null;

function getClient(): Anthropic {
  return _anthropicOverride || anthropic;
}

function getModel(): string {
  return _modelOverride || config.anthropic.model;
}

/** @internal SDK escape hatch — allows Cortex to inject a pre-configured Anthropic client. */
export function _setAnthropicClient(client: Anthropic, model?: string): void {
  _anthropicOverride = client;
  _modelOverride = model || null;
}

export interface GenerateOptions {
  userMessage: string;
  context?: string;
  moodModifier?: string;
  tierModifier?: string;
  agentModifier?: string;
  featureInstruction?: string;
  memoryContext?: string;
  maxTokens?: number;
}

export async function generateResponse(options: GenerateOptions): Promise<string> {
  const systemParts = [_systemPromptProvider()];

  if (options.memoryContext) systemParts.push(`\n\n${options.memoryContext}`);
  if (options.moodModifier) systemParts.push(`\n\n## Current Mood\n${options.moodModifier}`);
  if (options.tierModifier) systemParts.push(`\n\n## User Context\n${options.tierModifier}`);
  if (options.agentModifier) systemParts.push(`\n\n## Agent Context\n${options.agentModifier}`);
  if (options.featureInstruction) systemParts.push(`\n\n## Task\n${options.featureInstruction}`);

  const systemPrompt = systemParts.join('');

  // Build user content — ensure it's never empty
  let userContent = (options.userMessage || '').replace(/@\w+/g, '').trim();
  if (options.context) {
    userContent = `## Data\n${options.context}\n\n## User Message\n${userContent || '(no message, just a mention)'}`;
  }
  if (!userContent) {
    userContent = '(Someone mentioned you with no specific message. React to being summoned for nothing.)';
  }

  log.debug({ systemLength: systemPrompt.length, userLength: userContent.length }, 'Generating response');

  const response = await getClient().messages.create({
    model: getModel(),
    max_tokens: options.maxTokens || 300,
    temperature: 0.9,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  let text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();

  // Strip any quotes the model may wrap the response in
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }

  // Apply post-processor (bot uses this for random closers)
  text = _responsePostProcessor(text);

  // Security guardrail — block dangerous output before it reaches the user
  const guardrail = checkOutput(text);
  if (!guardrail.safe) {
    log.warn({ reason: guardrail.reason, textLength: text.length }, 'Response blocked by guardrail — regenerating');
    // Return a safe generic response instead of the blocked one
    text = 'Good question. Let me think about that and get back to you.';
  }

  log.info({ responseLength: text.length }, 'Response generated');
  return text;
}

/**
 * Single-purpose LLM call to rate memory importance (Park et al. 2023).
 * Returns a raw string (expected: single integer 1-10).
 * Uses low maxTokens and temperature 0 for deterministic, fast scoring.
 */
export async function generateImportanceScore(description: string): Promise<string> {
  const importancePrompt = process.env.CLUDE_IMPORTANCE_PROMPT ||
    'You rate the importance of events for an AI agent. ' +
    'Respond with ONLY a single integer from 1 to 10. ' +
    '1 = purely mundane. 5 = moderately important. 10 = extremely significant.';

  const response = await getClient().messages.create({
    model: getModel(),
    max_tokens: 10,
    temperature: 0,
    system: importancePrompt,
    messages: [{
      role: 'user',
      content: `Rate the importance of this event:\n"${description.slice(0, 500)}"\nRating (1-10):`,
    }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

export async function generateThread(options: GenerateOptions): Promise<string[]> {
  const response = await generateResponse({
    ...options,
    maxTokens: 1200,
    featureInstruction: (options.featureInstruction || '') +
      '\n\nFormat: Write 3-5 tweets separated by ---. Each tweet must be under 270 characters.',
  });

  return response
    .split('---')
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => t.slice(0, 280));
}

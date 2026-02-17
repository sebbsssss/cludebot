import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { createChildLogger } from './logger';
import { getBasePrompt, getRandomCloser } from '../character/base-prompt';

const log = createChildLogger('claude-client');

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
  const systemParts = [getBasePrompt()];

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

  // Occasionally append a random closer if it fits
  const closer = getRandomCloser();
  if (closer && text.length + closer.length + 2 <= 270) {
    text = `${text} ${closer}`;
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
  const response = await getClient().messages.create({
    model: getModel(),
    max_tokens: 10,
    temperature: 0,
    system:
      'You rate the importance of events for an AI agent called Clude. ' +
      'an AI agent with persistent memory. ' +
      'Respond with ONLY a single integer from 1 to 10. ' +
      '1 = purely mundane (a greeting, a generic question). ' +
      '5 = moderately important (a returning user, a market opinion request). ' +
      '10 = extremely significant (a whale selling everything, a deeply personal interaction, an existential realization).',
    messages: [{
      role: 'user',
      content: `Rate the importance of this event for Clude:\n"${description.slice(0, 500)}"\nRating (1-10):`,
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

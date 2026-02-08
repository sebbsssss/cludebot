import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { createChildLogger } from './logger';
import { getBasePrompt } from '../character/base-prompt';

const log = createChildLogger('claude-client');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface GenerateOptions {
  userMessage: string;
  context?: string;
  moodModifier?: string;
  tierModifier?: string;
  featureInstruction?: string;
  maxTokens?: number;
}

export async function generateResponse(options: GenerateOptions): Promise<string> {
  const systemParts = [getBasePrompt()];

  if (options.moodModifier) systemParts.push(`\n\n## Current Mood\n${options.moodModifier}`);
  if (options.tierModifier) systemParts.push(`\n\n## User Context\n${options.tierModifier}`);
  if (options.featureInstruction) systemParts.push(`\n\n## Task\n${options.featureInstruction}`);

  const systemPrompt = systemParts.join('');

  let userContent = options.userMessage;
  if (options.context) {
    userContent = `## Data\n${options.context}\n\n## User Message\n${options.userMessage}`;
  }

  log.debug({ systemLength: systemPrompt.length, userLength: userContent.length }, 'Generating response');

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: options.maxTokens || 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  log.info({ responseLength: text.length }, 'Response generated');
  return text;
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

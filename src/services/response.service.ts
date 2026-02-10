import { generateResponse, generateThread, GenerateOptions } from '../core/claude-client';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { recallMemories, formatMemoryContext, type RecallOptions } from '../core/memory';

/**
 * Response service — abstracts the repeated mood → modifier → memory → generate pattern.
 *
 * Every feature was doing this inline:
 *   1. getCurrentMood()
 *   2. getMoodModifier(mood)
 *   3. optionally recallMemories()
 *   4. generateResponse({ ...options, moodModifier, memoryContext })
 *
 * This service encapsulates that pipeline into a single call.
 */

export interface ContextOptions {
  message: string;
  context?: string;
  tierModifier?: string;
  agentModifier?: string;
  instruction: string;
  maxTokens?: number;
  memory?: RecallOptions;
  skipMood?: boolean;
}

export async function buildAndGenerate(opts: ContextOptions): Promise<string> {
  const generateOpts = await buildGenerateOptions(opts);
  return generateResponse(generateOpts);
}

export async function buildAndGenerateThread(opts: ContextOptions): Promise<string[]> {
  const generateOpts = await buildGenerateOptions(opts);
  return generateThread(generateOpts);
}

async function buildGenerateOptions(opts: ContextOptions): Promise<GenerateOptions> {
  const mood = opts.skipMood ? undefined : getCurrentMood();
  const moodModifier = mood ? getMoodModifier(mood) : undefined;

  let memoryContext: string | undefined;
  if (opts.memory) {
    const memories = await recallMemories(opts.memory);
    const formatted = formatMemoryContext(memories);
    if (formatted) memoryContext = formatted;
  }

  return {
    userMessage: opts.message,
    context: opts.context,
    moodModifier,
    tierModifier: opts.tierModifier,
    agentModifier: opts.agentModifier,
    featureInstruction: opts.instruction,
    memoryContext,
    maxTokens: opts.maxTokens,
  };
}

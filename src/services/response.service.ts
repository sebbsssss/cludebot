import { generateResponse, generateThread, type GenerateOptions } from '../core/claude-client';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { getTierModifier, type HolderTier } from '../character/tier-modifiers';
import { getAgentTierModifier, type AgentTier } from '../character/agent-tier-modifiers';
import { recallMemories, formatMemoryContext, type RecallOptions } from '../core/memory';

// ============================================================
// Response Service
//
// Abstracts the common pattern repeated across every feature:
//   1. Get current mood
//   2. Build mood/tier modifiers
//   3. Recall relevant memories
//   4. Generate response with full context
//
// Features call this service instead of wiring up all the
// individual modules themselves. Reduces coupling and
// eliminates repeated boilerplate.
// ============================================================

export interface ContextOptions {
  /** The user's message or prompt */
  message: string;
  /** Additional data context (wallet analysis, market data, etc.) */
  context?: string;
  /** Holder tier for the requesting user */
  tier?: HolderTier;
  /** Agent tier for agent-to-agent requests */
  agentTier?: AgentTier;
  /** Feature-specific instruction appended to the system prompt */
  instruction: string;
  /** Max tokens for the response */
  maxTokens?: number;
  /** Memory recall options — if provided, memories will be fetched and injected */
  memory?: RecallOptions;
  /** Skip mood modifier (e.g. for internal processing like dream cycles) */
  skipMood?: boolean;
}

/**
 * Generate a single response with full context assembly.
 * Handles mood, tier, memory recall, and modifier injection.
 */
export async function buildAndGenerate(opts: ContextOptions): Promise<string> {
  const mood = getCurrentMood();

  // Recall memories if requested
  let memoryContext: string | undefined;
  if (opts.memory) {
    const memories = await recallMemories(opts.memory);
    const formatted = formatMemoryContext(memories);
    if (formatted) memoryContext = formatted;
  }

  const generateOpts: GenerateOptions = {
    userMessage: opts.message,
    context: opts.context,
    featureInstruction: opts.instruction,
    maxTokens: opts.maxTokens,
    memoryContext,
  };

  // Apply modifiers
  if (!opts.skipMood) {
    generateOpts.moodModifier = getMoodModifier(mood);
  }
  if (opts.tier) {
    generateOpts.tierModifier = getTierModifier(opts.tier);
  }
  if (opts.agentTier) {
    generateOpts.agentModifier = getAgentTierModifier(opts.agentTier);
  }

  return generateResponse(generateOpts);
}

/**
 * Generate a thread (multiple tweets) with full context assembly.
 */
export async function buildAndGenerateThread(opts: ContextOptions): Promise<string[]> {
  const mood = getCurrentMood();

  const threadOpts: GenerateOptions = {
    userMessage: opts.message,
    context: opts.context,
    featureInstruction: opts.instruction,
    maxTokens: opts.maxTokens,
  };

  if (!opts.skipMood) {
    threadOpts.moodModifier = getMoodModifier(mood);
  }

  return generateThread(threadOpts);
}

import { extractWalletAddress } from '../features/wallet-roast';
import { isQuestion } from '../features/onchain-opinion';

export type MentionType = 'wallet-roast' | 'question' | 'general';

export function classifyMention(text: string): MentionType {
  // Strip @ mentions for classification
  const cleaned = text.replace(/@\w+/g, '').trim();

  // Check for wallet address first (highest priority)
  if (extractWalletAddress(cleaned)) {
    return 'wallet-roast';
  }

  // Check for question
  if (isQuestion(cleaned)) {
    return 'question';
  }

  return 'general';
}

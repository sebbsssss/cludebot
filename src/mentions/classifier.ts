import { extractWalletAddress, isQuestion, cleanMentionText } from '../utils/text';

export type MentionType = 'wallet-roast' | 'question' | 'memory-recall' | 'general';

const MEMORY_RECALL_PATTERNS = [
  /do you remember/i,
  /what do you (?:remember|recall|know) about (?:me|us|our)/i,
  /remember (?:me|our|what we)/i,
  /our (?:conversation|chat|history|past)/i,
  /have we (?:talked|spoken|chatted|met)/i,
  /what(?:'s| is| was) our history/i,
  /pull up (?:my|our) (?:memory|memories|history)/i,
  /what have we (?:discussed|talked about)/i,
];

export function classifyMention(text: string): MentionType {
  // Strip @ mentions for classification
  const cleaned = cleanMentionText(text);

  // Check for memory recall requests first
  if (MEMORY_RECALL_PATTERNS.some(p => p.test(cleaned))) {
    return 'memory-recall';
  }

  // Wallet roast disabled for now — treat wallet mentions as general replies
  // if (extractWalletAddress(cleaned)) {
  //   return 'wallet-roast';
  // }

  // Check for question
  if (isQuestion(cleaned)) {
    return 'question';
  }

  return 'general';
}

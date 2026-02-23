import { extractWalletAddress, isQuestion, cleanMentionText } from '../utils/text';

export type MentionType = 'wallet-roast' | 'question' | 'general';

export function classifyMention(text: string): MentionType {
  // Strip @ mentions for classification
  const cleaned = cleanMentionText(text);

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

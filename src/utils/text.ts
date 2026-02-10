// ============================================================
// Text Processing Utilities
//
// Shared text cleaning and extraction functions used across
// mention processing, feature handlers, and memory storage.
// ============================================================

/** Solana base58 address pattern (32-44 chars) */
export const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/**
 * Remove @mentions from tweet text and trim whitespace.
 */
export function cleanMentionText(text: string): string {
  return text.replace(/@\w+/g, '').trim();
}

/**
 * Extract a valid Solana wallet address from text.
 * Returns the first match that passes length validation, or null.
 */
export function extractWalletAddress(text: string): string | null {
  const matches = text.match(SOLANA_ADDRESS_REGEX);
  if (!matches) return null;
  const valid = matches.find(m => m.length >= 32 && m.length <= 44);
  return valid || null;
}

/**
 * Detect whether text contains a question.
 * Checks for question marks and common question-starting words.
 */
export function isQuestion(text: string): boolean {
  const cleaned = cleanMentionText(text);
  return (
    cleaned.includes('?') ||
    /^(ask|what|why|how|when|where|will|should|can|is|do|does)\b/i.test(cleaned)
  );
}

/**
 * Extract $TOKEN mentions from text.
 * Returns uppercased token symbols (e.g. ["$SOL", "$BONK"]).
 */
export function extractTokenMentions(text: string): string[] {
  const matches = text.match(/\$[A-Z]{2,10}/gi);
  return matches ? matches.map(t => t.toUpperCase()) : [];
}

/**
 * Pick a random element from an array.
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

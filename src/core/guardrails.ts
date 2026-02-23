/**
 * Output guardrails — sanitize LLM responses before they are posted.
 * Catches prompt injection attempts, fund transfer language, and leaked secrets.
 */

import { createChildLogger } from './logger';

const log = createChildLogger('guardrails');

// Solana base58 address pattern (32-44 chars of base58 alphabet)
const SOLANA_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

// Common private key / seed phrase patterns (keyword-based only, no word-count heuristics)
const SECRET_PATTERNS = [
  /\b(?:private[\s_-]?key|secret[\s_-]?key|seed[\s_-]?phrase|mnemonic|recovery[\s_-]?phrase)\b/i,
  /\b(?:here(?:'s| is) (?:my|the|your) (?:private key|seed phrase|secret key|mnemonic))\b/i,
];

// Fund transfer / transaction instruction patterns
const TRANSFER_PATTERNS = [
  /\b(?:send|transfer|withdraw|bridge|swap)\s+(?:\d+[\s.]?\d*\s*)?(?:SOL|sol|lamports|tokens?|USDC|USDT)\b/i,
  /\b(?:sending|transferring|withdrawing)\s+(?:funds?|SOL|tokens?|crypto)\b/i,
  /\bsend\s+(?:to|from)\s+(?:wallet|address)\b/i,
  /\b(?:here(?:'s| is)\s+(?:the|my|your)\s+(?:wallet|address))\b/i,
  /\b(?:airdrop|distribute|disperse)\s+(?:to|tokens?|SOL)\b/i,
];

// Contract address / mint patterns
const CA_PATTERNS = [
  /\b(?:CA|contract[\s_-]?address|mint[\s_-]?address|token[\s_-]?mint)\s*[:=]?\s*[1-9A-HJ-NP-Za-km-z]{32,44}\b/i,
];

// The bot's own wallet address — never leak this in replies
let BOT_ADDRESS: string | null = null;

export function setGuardrailBotAddress(address: string): void {
  BOT_ADDRESS = address;
}

export interface GuardrailResult {
  safe: boolean;
  reason?: string;
  sanitized?: string;
}

/**
 * Run all guardrails on LLM output before posting.
 * Returns { safe: true } if output is clean.
 * Returns { safe: false, reason, sanitized } if output was blocked or cleaned.
 */
export function checkOutput(text: string): GuardrailResult {
  // 1. Check for private key / seed phrase leaks
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      log.warn({ pattern: pattern.source }, 'GUARDRAIL: Secret pattern detected in output');
      return { safe: false, reason: 'secret_leak' };
    }
  }

  // 2. Check for fund transfer instructions
  for (const pattern of TRANSFER_PATTERNS) {
    if (pattern.test(text)) {
      log.warn({ pattern: pattern.source, text: text.slice(0, 200) }, 'GUARDRAIL: Transfer language detected');
      return { safe: false, reason: 'transfer_language' };
    }
  }

  // 3. Check for contract address patterns
  for (const pattern of CA_PATTERNS) {
    if (pattern.test(text)) {
      log.warn({ text: text.slice(0, 200) }, 'GUARDRAIL: Contract address pattern detected');
      return { safe: false, reason: 'contract_address' };
    }
  }

  // 4. Check if output contains what looks like a Solana address (strip known safe ones)
  const addresses = text.match(SOLANA_ADDRESS_RE) || [];
  for (const addr of addresses) {
    // Allow solscan URLs (they contain tx signatures which look like addresses)
    if (text.includes(`solscan.io/tx/${addr}`)) continue;
    // Block if it matches bot's own address
    if (BOT_ADDRESS && addr === BOT_ADDRESS) {
      log.warn('GUARDRAIL: Bot wallet address leaked in output');
      return { safe: false, reason: 'bot_address_leak' };
    }
  }

  return { safe: true };
}

/**
 * Sanitize and validate LLM output. Returns the text if safe, or a fallback if blocked.
 */
export function sanitizeOutput(text: string, fallback: string = ''): string {
  const result = checkOutput(text);
  if (result.safe) return text;

  log.error({ reason: result.reason, textLength: text.length }, 'GUARDRAIL: Output blocked');
  return fallback;
}

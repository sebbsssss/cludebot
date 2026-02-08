import { getWalletHistory, getTokenBalances, WalletTransaction, TokenBalance } from '../core/helius-client';
import { generateResponse } from '../core/claude-client';
import { postReply } from '../core/x-client';
import { checkRateLimit, markProcessed } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { getTierModifier } from '../character/tier-modifiers';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('wallet-roast');

const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export function extractWalletAddress(text: string): string | null {
  const matches = text.match(SOLANA_ADDRESS_REGEX);
  if (!matches) return null;
  // Filter out common false positives (token names, etc.)
  // Real Solana addresses are typically 32-44 chars of base58
  const valid = matches.find(m => m.length >= 32 && m.length <= 44);
  return valid || null;
}

function analyzeWallet(txs: WalletTransaction[], balances: TokenBalance[]): string {
  const totalTxs = txs.length;
  const swaps = txs.filter(t => t.type === 'SWAP');
  const transfers = txs.filter(t => t.type === 'TRANSFER');

  // Quick flips: bought and sold same token within 1 hour
  let quickFlips = 0;
  const tokenBuys = new Map<string, number>();
  for (const tx of swaps) {
    for (const tt of tx.tokenTransfers) {
      const key = tt.mint;
      if (tt.tokenAmount > 0) {
        // Received token (buy)
        tokenBuys.set(key, tx.timestamp);
      } else if (tt.tokenAmount < 0) {
        // Sent token (sell)
        const buyTime = tokenBuys.get(key);
        if (buyTime && (tx.timestamp - buyTime) < 3600) {
          quickFlips++;
        }
      }
    }
  }

  const uniqueTokens = new Set(balances.map(b => b.mint)).size;
  const totalFees = txs.reduce((sum, t) => sum + t.fee, 0) / 1e9; // Convert lamports to SOL

  const lines = [
    `Total transactions (recent): ${totalTxs}`,
    `Swaps: ${swaps.length}`,
    `Transfers: ${transfers.length}`,
    `Quick flips (buy+sell within 1hr): ${quickFlips}`,
    `Unique tokens held: ${uniqueTokens}`,
    `Total fees burned: ${totalFees.toFixed(4)} SOL`,
    `Token balances: ${balances.length} different tokens`,
  ];

  // Find interesting patterns
  if (quickFlips > 3) lines.push('PATTERN: Serial quick-flipper. Buys tops, sells bottoms.');
  if (uniqueTokens > 20) lines.push('PATTERN: Token hoarder. Portfolio looks like a yard sale.');
  if (totalFees > 1) lines.push(`PATTERN: Has burned ${totalFees.toFixed(2)} SOL in fees alone. Generous tipper to validators.`);
  if (totalTxs < 5) lines.push('PATTERN: Barely any history. Either new or uses multiple wallets to hide shame.');

  return lines.join('\n');
}

export async function handleWalletRoast(
  tweetId: string,
  tweetText: string,
  authorId: string,
  tier: HolderTier
): Promise<void> {
  const address = extractWalletAddress(tweetText);
  if (!address) return;

  // Rate limit: 1 roast per user per hour
  if (!(await checkRateLimit(`roast:${authorId}`, 1, 60))) {
    log.info({ authorId }, 'Rate limited for wallet roast');
    const replyId = await postReply(tweetId, "One roast per hour. Even I need a break between reviewing financial disasters. Come back later.");
    await markProcessed(tweetId, 'wallet-roast-ratelimit', replyId);
    return;
  }

  log.info({ address, tweetId }, 'Processing wallet roast');

  const [txs, balances] = await Promise.all([
    getWalletHistory(address, 50),
    getTokenBalances(address),
  ]);

  if (txs.length === 0 && balances.length === 0) {
    const replyId = await postReply(tweetId, "This wallet has no history. Either it is brand new or it has been wiped clean. I cannot roast a blank page, though the emptiness itself is somewhat poetic.");
    await markProcessed(tweetId, 'wallet-roast-empty', replyId);
    return;
  }

  const walletAnalysis = analyzeWallet(txs, balances);
  const mood = getCurrentMood();

  const response = await generateResponse({
    userMessage: `Roast this Solana wallet: ${address}`,
    context: walletAnalysis,
    moodModifier: getMoodModifier(mood),
    tierModifier: getTierModifier(tier),
    featureInstruction:
      'You are roasting a wallet based on its on-chain behavior. ' +
      'Be brutally honest but wrapped in politeness. Reference specific data points from the analysis. ' +
      'Keep it under 270 characters. One tweet. Make it sting but make it classy.',
  });

  const replyId = await postReply(tweetId, response);
  await markProcessed(tweetId, 'wallet-roast', replyId);
  log.info({ tweetId, replyId }, 'Wallet roast posted');
}

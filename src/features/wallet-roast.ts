import { getWalletHistory, getTokenBalances, WalletTransaction, TokenBalance } from '../core/helius-client';
import { checkRateLimit, markProcessed } from '../core/database';
import { HolderTier } from '../character/tier-modifiers';
import { extractWalletAddress } from '../utils/text';
import { lamportsToSol } from '../utils/format';
import { buildAndGenerate } from '../services/response.service';
import { replyAndMark } from '../services/social.service';
import { postReply } from '../core/x-client';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('wallet-roast');

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
  const totalFees = lamportsToSol(txs.reduce((sum, t) => sum + t.fee, 0));

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

  const response = await buildAndGenerate({
    message: `Roast this Solana wallet: ${address}`,
    context: walletAnalysis,
    tier,
    instruction:
      'You are roasting a wallet based on its on-chain behavior. ' +
      'Be brutally honest but wrapped in politeness. Reference specific data points from the analysis. ' +
      'Keep it under 270 characters. One tweet. Make it sting but make it classy.',
  });

  await replyAndMark(tweetId, response, 'wallet-roast');
  log.info({ tweetId }, 'Wallet roast posted');
}

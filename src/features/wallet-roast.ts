import { getWalletHistory, getTokenBalances, WalletTransaction, TokenBalance } from '../core/base-rpc-client';
import { postReply } from '../core/x-client';
import { checkRateLimit, markProcessed } from '../core/database';
import { getTierModifier } from '../character/tier-modifiers';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';
import { extractWalletAddress } from '../utils/text';
import { buildAndGenerate } from '../services/response.service';
import { replyAndMark } from '../services/social.service';

const log = createChildLogger('wallet-roast');

export { extractWalletAddress };

function analyzeWallet(txs: WalletTransaction[], balances: TokenBalance[]): string {
  const totalTxs = txs.length;
  const swaps = txs.filter(t => t.type === 'SWAP');
  const transfers = txs.filter(t => t.type === 'TRANSFER');
  const contractCalls = txs.filter(t => t.type === 'CONTRACT_CALL');
  const uniqueTargets = new Set(txs.map(t => t.to)).size;
  const totalGas = txs.reduce((sum, t) => sum + t.gasUsed, 0) / 1e18;

  const lines = [
    `Total transactions (recent): ${totalTxs}`,
    `Swaps: ${swaps.length}`,
    `Transfers: ${transfers.length}`,
    `Contract calls: ${contractCalls.length}`,
    `Unique addresses interacted: ${uniqueTargets}`,
    `Total gas burned: ${totalGas.toFixed(6)} ETH`,
    `Token balances: ${balances.length} different tokens`,
  ];

  if (swaps.length > totalTxs * 0.7) lines.push('PATTERN: Mostly swaps. Degen trader energy.');
  if (uniqueTargets > 15) lines.push('PATTERN: Interacts with everything. Portfolio like a buffet.');
  if (totalGas > 0.01) lines.push(`PATTERN: Has burned ${totalGas.toFixed(4)} ETH in gas alone. Contributing to ETH deflation.`);
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
    message: `Roast this wallet on Base: ${address}`,
    context: walletAnalysis,
    tierModifier: getTierModifier(tier),
    instruction:
      'You are roasting a wallet based on its on-chain behavior. ' +
      'Be brutally honest but wrapped in politeness. Reference specific data points from the analysis. ' +
      'Keep it under 270 characters. One tweet. Make it sting but make it classy.',
  });

  await replyAndMark(tweetId, response, 'wallet-roast');
  log.info({ tweetId }, 'Wallet roast posted');
}

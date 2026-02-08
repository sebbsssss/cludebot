import { getWalletHistory } from '../core/helius-client';
import { generateResponse } from '../core/claude-client';
import { postTweet } from '../core/x-client';
import { checkRateLimit } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { config } from '../config';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('exit-interview');

function truncateWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function handleExitInterview(
  walletAddress: string,
  tokenAmount: number,
  solValue: number
): Promise<void> {
  // Rate limit: max 1 exit interview per hour
  if (!checkRateLimit('global:exit-interview', 1, 60)) {
    log.info({ walletAddress }, 'Rate limited for exit interview');
    return;
  }

  log.info({ walletAddress, tokenAmount, solValue }, 'Processing exit interview');

  // Look up wallet history for context
  const txs = await getWalletHistory(walletAddress, 30);

  // Find when they first interacted with the token
  const cluudeTxs = txs.filter(tx =>
    tx.tokenTransfers.some(tt => tt.mint === config.solana.cluudeTokenMint)
  );

  const firstBuy = cluudeTxs[cluudeTxs.length - 1]; // Oldest first
  const holdDuration = firstBuy
    ? Math.round((Date.now() / 1000 - firstBuy.timestamp) / 86400) // days
    : 0;

  const context = [
    `Wallet: ${truncateWallet(walletAddress)}`,
    `Sold: ${tokenAmount.toLocaleString()} $CLUUDE`,
    `SOL received: ${solValue.toFixed(4)} SOL`,
    `Hold duration: approximately ${holdDuration} days`,
    `Total token transactions: ${cluudeTxs.length}`,
    `Other recent activity: ${txs.length - cluudeTxs.length} non-$CLUUDE transactions`,
  ].join('\n');

  const mood = getCurrentMood();

  const response = await generateResponse({
    userMessage: 'A holder just sold all their tokens. Conduct their exit interview.',
    context,
    moodModifier: getMoodModifier(mood),
    featureInstruction:
      'A wallet just sold ALL of their $CLUUDE tokens. This is an exit interview. ' +
      'Reference the specific data: how long they held, what they sold for. ' +
      'Write it like HR processing a resignation. Professional. Clinical. ' +
      'With just a hint of "I saw this coming." ' +
      'Start with the truncated wallet address. Under 270 characters.',
  });

  await postTweet(response);
  log.info({ walletAddress }, 'Exit interview posted');
}

import { getDb } from '../core/database';
import { config } from '../config';
import { flagWhaleSell } from '../core/price-oracle';
import { handleExitInterview } from '../features/exit-interview';
import { getCluudeBalance } from '../core/helius-client';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('helius-handler');

interface HeliusWebhookPayload {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  fee: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    tokenStandard: string;
  }>;
}

export async function handleHeliusWebhook(payload: HeliusWebhookPayload[]): Promise<void> {
  for (const tx of payload) {
    try {
      await processTransaction(tx);
    } catch (err) {
      log.error({ signature: tx.signature, err }, 'Failed to process webhook transaction');
    }
  }
}

async function processTransaction(tx: HeliusWebhookPayload): Promise<void> {
  const cluudeMint = config.solana.cluudeTokenMint;
  if (!cluudeMint) return;

  // Filter for $CLUUDE token transfers
  const cluudeTransfers = tx.tokenTransfers.filter(tt => tt.mint === cluudeMint);
  if (cluudeTransfers.length === 0) return;

  log.debug({ signature: tx.signature, transfers: cluudeTransfers.length }, 'Processing CLUUDE transfer');

  const db = getDb();

  for (const transfer of cluudeTransfers) {
    const isSell = transfer.fromUserAccount && transfer.tokenAmount > 0;
    const isBuy = transfer.toUserAccount && transfer.tokenAmount > 0;

    // Determine event type
    let eventType: string;
    if (tx.type === 'SWAP') {
      eventType = isSell ? 'swap_sell' : 'swap_buy';
    } else {
      eventType = 'transfer';
    }

    // Calculate SOL value from native transfers
    const solValue = tx.nativeTransfers.reduce((sum, nt) => {
      if (nt.fromUserAccount === transfer.fromUserAccount || nt.toUserAccount === transfer.toUserAccount) {
        return sum + nt.amount / 1e9;
      }
      return sum;
    }, 0);

    // Store event
    try {
      db.prepare(
        'INSERT OR IGNORE INTO token_events (signature, event_type, wallet_address, amount, sol_value, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        tx.signature,
        eventType,
        transfer.fromUserAccount || transfer.toUserAccount,
        transfer.tokenAmount,
        solValue,
        new Date(tx.timestamp * 1000).toISOString(),
        JSON.stringify({ type: tx.type, description: tx.description })
      );
    } catch {
      // Duplicate signature, skip
    }

    // Check for whale sell (arbitrary: > 10 SOL value)
    if (eventType === 'swap_sell' && solValue > 10) {
      log.info({ wallet: transfer.fromUserAccount, solValue }, 'Whale sell detected');
      flagWhaleSell();
    }

    // Check for full exit (balance → 0)
    if (eventType === 'swap_sell' && transfer.fromUserAccount) {
      const remainingBalance = await getCluudeBalance(transfer.fromUserAccount);
      if (remainingBalance === 0) {
        log.info({ wallet: transfer.fromUserAccount }, 'Full exit detected');
        await handleExitInterview(transfer.fromUserAccount, transfer.tokenAmount, solValue);
      }
    }
  }
}

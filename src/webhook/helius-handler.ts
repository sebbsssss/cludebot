import { getDb } from '../core/database';
import { config } from '../config';
import { flagWhaleSell } from '../core/price-oracle';
import { handleExitInterview } from '../features/exit-interview';
import { getCludeBalance } from '../core/helius-client';
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
  const cludeMint = config.solana.cludeTokenMint;
  if (!cludeMint) return;

  // Filter for $CLUDE token transfers
  const cludeTransfers = tx.tokenTransfers.filter(tt => tt.mint === cludeMint);
  if (cludeTransfers.length === 0) return;

  log.debug({ signature: tx.signature, transfers: cludeTransfers.length }, 'Processing CLUDE transfer');

  const db = getDb();

  for (const transfer of cludeTransfers) {
    const isSell = transfer.fromUserAccount && transfer.tokenAmount > 0;

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

    // Store event (upsert to handle duplicates)
    await db
      .from('token_events')
      .upsert({
        signature: tx.signature,
        event_type: eventType,
        wallet_address: transfer.fromUserAccount || transfer.toUserAccount,
        amount: transfer.tokenAmount,
        sol_value: solValue,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        metadata: { type: tx.type, description: tx.description },
      }, { onConflict: 'signature' });

    // Check for whale sell (arbitrary: > 10 SOL value)
    if (eventType === 'swap_sell' && solValue > 10) {
      log.info({ wallet: transfer.fromUserAccount, solValue }, 'Whale sell detected');
      flagWhaleSell();
    }

    // Check for full exit (balance → 0)
    if (eventType === 'swap_sell' && transfer.fromUserAccount) {
      const remainingBalance = await getCludeBalance(transfer.fromUserAccount);
      if (remainingBalance === 0) {
        log.info({ wallet: transfer.fromUserAccount }, 'Full exit detected');
        await handleExitInterview(transfer.fromUserAccount, transfer.tokenAmount, solValue);
      }
    }
  }
}

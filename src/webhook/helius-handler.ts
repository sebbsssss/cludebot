import { getDb } from '../core/database';
import { config } from '../config';
import { getCluudeBalance } from '../core/helius-client';
import { eventBus } from '../events/event-bus';
import { lamportsToSol } from '../utils/format';
import { createChildLogger } from '../core/logger';
import type { HeliusWebhookPayload } from '../types/api';

const log = createChildLogger('helius-handler');

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

  const cluudeTransfers = tx.tokenTransfers.filter(tt => tt.mint === cluudeMint);
  if (cluudeTransfers.length === 0) return;

  log.debug({ signature: tx.signature, transfers: cluudeTransfers.length }, 'Processing CLUUDE transfer');

  const db = getDb();

  for (const transfer of cluudeTransfers) {
    const isSell = transfer.fromUserAccount && transfer.tokenAmount > 0;

    let eventType: string;
    if (tx.type === 'SWAP') {
      eventType = isSell ? 'swap_sell' : 'swap_buy';
    } else {
      eventType = 'transfer';
    }

    const solValue = tx.nativeTransfers.reduce((sum, nt) => {
      if (nt.fromUserAccount === transfer.fromUserAccount || nt.toUserAccount === transfer.toUserAccount) {
        return sum + lamportsToSol(nt.amount);
      }
      return sum;
    }, 0);

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

    // Emit events instead of directly calling features (decoupled via EventBus)
    eventBus.emit('token:event', {
      signature: tx.signature,
      eventType,
      wallet: transfer.fromUserAccount || transfer.toUserAccount,
      solValue,
    });

    if (eventType === 'swap_sell' && solValue > 10) {
      log.info({ wallet: transfer.fromUserAccount, solValue }, 'Whale sell detected');
      eventBus.emit('whale:sell', {
        wallet: transfer.fromUserAccount,
        solValue,
        signature: tx.signature,
      });
    }

    if (eventType === 'swap_sell' && transfer.fromUserAccount) {
      const remainingBalance = await getCluudeBalance(transfer.fromUserAccount);
      if (remainingBalance === 0) {
        log.info({ wallet: transfer.fromUserAccount }, 'Full exit detected');
        eventBus.emit('holder:exit', {
          wallet: transfer.fromUserAccount,
          tokenAmount: transfer.tokenAmount,
          solValue,
        });
      }
    }
  }
}

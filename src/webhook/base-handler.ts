import { getDb } from '../core/database';
import { config } from '../config';
import { getCludeBalance } from '../core/base-rpc-client';
import { createChildLogger } from '../core/logger';
import { eventBus } from '../events/event-bus';
import { weiToEth } from '../utils/format';
import { BASESCAN_API_BASE_URL } from '../utils/constants';
import type { BasescanTokenTxResponse } from '../types/api';

const log = createChildLogger('base-handler');

let lastSeenTimestamp = Math.floor(Date.now() / 1000);
let pollTimer: ReturnType<typeof setInterval> | null = null;

export async function pollTokenEvents(): Promise<void> {
  const cludeAddress = config.base.cludeTokenAddress;
  if (!cludeAddress || !config.base.basescanApiKey) return;

  try {
    const url = `${BASESCAN_API_BASE_URL}?module=account&action=tokentx&contractaddress=${cludeAddress}&sort=desc&page=1&offset=20&apikey=${config.base.basescanApiKey}`;
    const res = await fetch(url);
    const data = await res.json() as BasescanTokenTxResponse;

    if (data.status !== '1' || !Array.isArray(data.result)) return;

    const newTxs = data.result.filter(tx => parseInt(tx.timeStamp) > lastSeenTimestamp);
    if (newTxs.length === 0) return;

    // Update last seen
    lastSeenTimestamp = Math.max(...newTxs.map(tx => parseInt(tx.timeStamp)));

    for (const tx of newTxs) {
      await processTokenTransfer(tx);
    }
  } catch (err) {
    log.error({ err }, 'Failed to poll token events');
  }
}

async function processTokenTransfer(tx: BasescanTokenTxResponse['result'][0]): Promise<void> {
  const db = getDb();
  const decimals = parseInt(tx.tokenDecimal) || 18;
  const amount = Number(BigInt(tx.value)) / Math.pow(10, decimals);

  // Determine event type based on direction
  // For now, classify as transfer. Swap detection would require checking if the tx interacted with a DEX router.
  const eventType = 'transfer';

  // Calculate ETH value from gas (rough proxy — actual value would need DEX trade parsing)
  const ethValue = weiToEth(Number(tx.gasUsed) * Number(tx.gasPrice));

  // Store event
  await db
    .from('token_events')
    .upsert({
      signature: tx.hash,
      event_type: eventType,
      wallet_address: tx.from,
      amount,
      sol_value: ethValue, // column name kept for DB compat, stores ETH value
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      metadata: { from: tx.from, to: tx.to, contractAddress: tx.contractAddress },
    }, { onConflict: 'signature' });

  // Check for whale transfer (> 5 ETH gas equivalent is rough — we'll refine when token is live)
  if (ethValue > config.activity.whaleThreshold) {
    log.info({ wallet: tx.from, ethValue }, 'Whale activity detected');
    eventBus.emit('whale:sell', { wallet: tx.from, solValue: ethValue, signature: tx.hash });
  }

  // Check for full exit (balance → 0)
  const remainingBalance = await getCludeBalance(tx.from);
  if (remainingBalance === 0 && amount > 0) {
    log.info({ wallet: tx.from }, 'Full exit detected');
    eventBus.emit('holder:exit', { wallet: tx.from, tokenAmount: amount, solValue: ethValue });
  }
}

export function startTokenEventPoller(): void {
  if (pollTimer) return;
  const intervalMs = 30_000; // Poll every 30 seconds
  log.info({ intervalMs }, 'Starting Base token event poller');
  pollTokenEvents(); // Initial poll
  pollTimer = setInterval(pollTokenEvents, intervalMs);
}

export function stopTokenEventPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

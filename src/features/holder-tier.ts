import { getCluudeBalance } from '../core/helius-client';
import { getDb } from '../core/database';
import { config } from '../config';
import { HolderTier } from '../character/tier-modifiers';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('holder-tier');

interface WalletLink {
  wallet_address: string;
  x_handle: string;
}

export function getLinkedWallet(xUserId: string): WalletLink | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT wallet_address, x_handle FROM wallet_links WHERE x_user_id = ?'
  ).get(xUserId) as WalletLink | undefined;
  return row || null;
}

export async function determineHolderTier(xUserId: string): Promise<HolderTier> {
  const link = getLinkedWallet(xUserId);
  if (!link) return 'UNKNOWN';

  const balance = await getCluudeBalance(link.wallet_address);

  if (balance === 0) {
    // Check if they previously held tokens (seller detection)
    const db = getDb();
    const prevHeld = db.prepare(
      "SELECT 1 FROM token_events WHERE wallet_address = ? AND event_type = 'swap_buy' LIMIT 1"
    ).get(link.wallet_address);

    if (prevHeld) {
      log.debug({ xUserId, wallet: link.wallet_address }, 'Detected seller');
      return 'SELLER';
    }
    return 'ZERO';
  }

  if (balance >= config.tiers.whaleThreshold) return 'WHALE';
  if (balance >= config.tiers.smallThreshold) return 'SMALL';
  return 'ZERO';
}

export function linkWallet(xUserId: string, xHandle: string, walletAddress: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO wallet_links (x_user_id, x_handle, wallet_address, verified_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(xUserId, xHandle, walletAddress);
  log.info({ xUserId, xHandle, walletAddress }, 'Wallet linked');
}

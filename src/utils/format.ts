// ============================================================
// Formatting Utilities
//
// Shared formatting functions used across features.
// Centralised here to eliminate duplication and ensure
// consistent output across tweets, reports, and API responses.
// ============================================================

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Truncate a Solana wallet address for display: `7nYB...x4Kp`
 */
export function truncateWallet(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Format a USD value into a human-readable abbreviated string.
 * Examples: 1_500_000_000 → "1.5B", 2_300_000 → "2.3M", 800 → "800"
 */
export function formatUsd(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}

/**
 * Format a large number into abbreviated form.
 * Examples: 1_200_000 → "1.2M", 45_000 → "45K", 300 → "300"
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/**
 * Convert lamports to SOL.
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Human-readable relative time from an ISO date string.
 * Examples: "just now", "3h ago", "2d ago", "1w ago"
 */
export function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculate percentage change between two values.
 */
export function percentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return 0;
  return ((newVal - oldVal) / oldVal) * 100;
}

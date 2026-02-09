import { getMarketSnapshot, MarketSnapshot } from '../core/allium-client';
import { generateResponse } from '../core/claude-client';
import { postTweet } from '../core/x-client';
import { checkRateLimit } from '../core/database';
import { getCurrentMood } from '../core/price-oracle';
import { getMoodModifier } from '../character/mood-modifiers';
import { config } from '../config';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('market-monitor');

// Track recently posted events to avoid duplicates
const recentEventHashes = new Set<string>();
const MAX_RECENT_EVENTS = 50;

function hashEvent(event: string): string {
  let hash = 0;
  for (let i = 0; i < event.length; i++) {
    const char = event.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// Only post about majors (SOL, BTC, ETH) or well-known memecoins — not random microcaps
const MAJORS = new Set(['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'JTO', 'JUP', 'PYTH', 'RAY', 'RNDR', 'HNT']);
const KNOWN_MEMES = new Set(['BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'WEN', 'MYRO', 'SAMO', 'SLERF', 'PONKE', 'BOOK', 'MOODENG', 'PNUT', 'GOAT', 'ACT', 'AI16Z', 'FARTCOIN', 'GRIFFAIN', 'PENGU', 'TRUMP']);

function isNoteworthyToken(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return MAJORS.has(upper) || KNOWN_MEMES.has(upper);
}

function detectSignificantEvents(snapshot: MarketSnapshot): { context: string; eventKey: string } | null {
  const events: string[] = [];
  let eventKey = '';

  // SOL flash crash / mega pump: >8% in 1h is genuinely epic
  if (Math.abs(snapshot.solChange1h) > 8) {
    const dir = snapshot.solChange1h > 0 ? 'up' : 'down';
    events.push(`SOL ${dir} ${snapshot.solChange1h.toFixed(1)}% in the last hour ($${snapshot.solPrice.toFixed(2)})`);
    eventKey += `sol:${Math.floor(snapshot.solChange1h)}`;
  }

  // Only flag known memecoins / majors with truly extreme moves (>50% in 1h)
  const epicMovers = snapshot.topMovers
    .filter(m => Math.abs(m.priceChange1h) > 50 && isNoteworthyToken(m.symbol) && m.volume1h > 500_000);
  for (const mover of epicMovers.slice(0, 2)) {
    const dir = mover.priceChange1h > 0 ? '+' : '';
    events.push(`${mover.symbol}: ${dir}${mover.priceChange1h.toFixed(1)}% in 1h | $${formatUsd(mover.volume1h)} volume | ${formatNumber(mover.tradeCount1h)} trades`);
    eventKey += `move:${mover.symbol}:${Math.floor(mover.priceChange1h / 10)}`;
  }

  // Whale-level volume on known tokens only (>$1M volume spike with >30% move)
  const whaleMovers = snapshot.topMovers
    .filter(m => m.volume1h > 5_000_000 && Math.abs(m.priceChange1h) > 30 && isNoteworthyToken(m.symbol));
  for (const spike of whaleMovers.slice(0, 1)) {
    if (!events.some(e => e.includes(spike.symbol))) {
      events.push(`${spike.symbol}: $${formatUsd(spike.volume1h)} volume in 1h with ${spike.priceChange1h > 0 ? '+' : ''}${spike.priceChange1h.toFixed(1)}% move (${formatNumber(spike.tradeCount1h)} trades)`);
      eventKey += `vol:${spike.symbol}:${Math.floor(spike.volume1h / 1_000_000)}`;
    }
  }

  if (events.length === 0) return null;

  // Check for duplicate
  const hash = hashEvent(eventKey);
  if (recentEventHashes.has(hash)) {
    log.debug({ hash }, 'Skipping duplicate market event');
    return null;
  }

  // Build context
  const context = [
    'MARKET INTELLIGENCE REPORT',
    `SOL: $${snapshot.solPrice.toFixed(2)} (1h: ${snapshot.solChange1h > 0 ? '+' : ''}${snapshot.solChange1h.toFixed(2)}%, 24h: ${snapshot.solChange24h > 0 ? '+' : ''}${snapshot.solChange24h.toFixed(2)}%)`,
    `SOL 24h Volume: $${formatUsd(snapshot.solVolume24h)}`,
    '',
    'Notable Events:',
    ...events,
    '',
    'Top Active Tokens (by volatility):',
    ...snapshot.topMovers.slice(0, 5).map(m =>
      `  ${m.symbol}: $${m.priceUsd < 0.01 ? m.priceUsd.toExponential(2) : m.priceUsd.toFixed(4)} | 1h: ${m.priceChange1h > 0 ? '+' : ''}${m.priceChange1h.toFixed(1)}% | Vol: $${formatUsd(m.volume24h)} | ${formatNumber(m.holders)} holders`
    ),
  ].join('\n');

  return { context, eventKey: hash };
}

function formatUsd(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export async function checkAndPostMarketUpdate(): Promise<void> {
  if (!config.allium.apiKey) {
    log.debug('Allium API key not configured, skipping market monitor');
    return;
  }

  try {
    const snapshot = await getMarketSnapshot();
    const event = detectSignificantEvents(snapshot);

    if (!event) {
      log.debug('No significant market events detected');
      return;
    }

    // Rate limit: 1 market tweet per 2 hours (only epic events)
    const canPost = await checkRateLimit('global:market-monitor', 1, 120);
    if (!canPost) {
      log.debug('Rate limited on market tweets');
      return;
    }

    log.info({ eventKey: event.eventKey }, 'Significant market event detected, posting');

    const mood = getCurrentMood();

    const response = await generateResponse({
      userMessage: 'File a brief market intelligence report based on the data.',
      context: event.context,
      moodModifier: getMoodModifier(mood),
      featureInstruction:
        'You are Clude reporting on a genuinely significant market event — a flash crash, epic pump, or major ' +
        'memecoin blowup. This is NOT a routine update, something actually happened. You are a tired finance analyst ' +
        'who has seen too many charts but even you had to look up from your desk for this one. Reference specific ' +
        'numbers and token names from the data. Be sharp. Be dismissive of hype but acknowledge the magnitude. ' +
        'Under 270 characters. This is an unprompted market observation about something actually noteworthy.',
    });

    await postTweet(response);

    // Track this event
    recentEventHashes.add(event.eventKey);
    if (recentEventHashes.size > MAX_RECENT_EVENTS) {
      const first = recentEventHashes.values().next().value;
      if (first) recentEventHashes.delete(first);
    }

    log.info('Market update posted');
  } catch (err) {
    log.error({ err }, 'Market monitor check failed');
  }
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

export function startMarketMonitor(): void {
  if (!config.allium.apiKey) {
    log.info('Allium API key not configured — market monitor disabled');
    return;
  }

  log.info({ intervalMs: config.allium.pollIntervalMs }, 'Starting market monitor');

  // Initial check after a brief delay
  setTimeout(checkAndPostMarketUpdate, 30_000);

  monitorTimer = setInterval(checkAndPostMarketUpdate, config.allium.pollIntervalMs);
}

export function stopMarketMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

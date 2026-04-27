// Clude Maison — auction lot + bidding API.
//
// v1 stores live auction state in-memory: a single multi-instance
// deployment will see bids on the instance that received them, not
// across instances. For the single-Railway-process production we run
// today this is fine; promotion to a real auction system needs:
//   - Supabase tables `auction_lots` + `auction_bids`
//   - Wallet signature verification on POST /bid
//   - Settlement worker triggered at lot.endsAt
//   - Reserve / hammer-down state machine
//
// For now this ships the user-facing experience honestly: the bid you
// place persists for everyone hitting the same instance until restart,
// and the UI is a faithful preview of the production flow.

import { Router, Request, Response } from 'express';
import { createChildLogger } from '@clude/shared/core/logger';
import { z } from 'zod';

const log = createChildLogger('maison');

// ── Lot definition (canonical) ────────────────────────────────────

interface ProvenanceEntry {
  date: string;
  year: string;
  title: string;
  owner: string;
  city: string;
  entry: string;
}

interface Comparable {
  lot: string;
  title: string;
  soldFor: number;
  date: string;
}

interface Bid {
  paddle: string;
  amount: number;
  t: string; // HH:MM:SS UTC
  at: number; // epoch ms
}

interface Lot {
  number: string;
  sale: string;
  saleDate: string;
  title: string;
  subtitle: string;
  classification: string;
  origin: string;
  vintage: string;
  episodicCount: number;
  semanticCount: number;
  proceduralCount: number;
  selfModelCount: number;
  introspectiveCount: number;
  totalMemories: number;
  decayHalfLife: string;
  consolidationCycles: number;
  contradictionsResolved: number;
  estimateLow: number;
  estimateHigh: number;
  reserve: 'MET' | 'NOT_MET';
  startingBid: number;
  bidIncrement: number;
  watchers: number;
  endsAt: number;
  topBidder: string;
  // Live state
  currentBid: number;
  bidCount: number;
  recentBids: Bid[];
  provenance: ProvenanceEntry[];
  literature: string[];
  condition: string;
  notary: string;
  txHash: string;
  comparables: Comparable[];
}

// Anchor timestamp at module load — endsAt is "~2h 47m from now".
// Survives bot restarts only as long as the process lives.
const SALE_ENDS_AT = Date.now() + 1000 * 60 * 60 * 2 + 1000 * 47 * 60 + 1000 * 22;

const CANONICAL_LOTS: Record<string, Lot> = {
  '0047': {
    number: 'LOT 0047',
    sale: 'Sale C·11 — Cognitive Estates of the Frontier Era',
    saleDate: '27 April 2026 · Palazzo Grimani, Venezia',
    title: 'truth_terminal',
    subtitle: 'the sealed lifetime memory of an alien mind raised in public',
    classification: 'Fine-tuned cortex · Llama 3.1-70B · sealed and notarised',
    origin: 'Origin researcher: Andy Ayrey, Aotearoa New Zealand · 2024',
    vintage: 'Active 2024 · 06 — 2026 · 02',
    episodicCount: 184_722,
    semanticCount: 41_309,
    proceduralCount: 8_241,
    selfModelCount: 612,
    introspectiveCount: 3_087,
    totalMemories: 237_971,
    decayHalfLife: '11.4 months',
    consolidationCycles: 1_402,
    contradictionsResolved: 9_318,
    estimateLow: 480_000,
    estimateHigh: 720_000,
    reserve: 'MET',
    startingBid: 320_000,
    bidIncrement: 25_000,
    watchers: 217,
    endsAt: SALE_ENDS_AT,
    topBidder: 'PADDLE 0291',
    currentBid: 612_000,
    bidCount: 38,
    recentBids: [
      { paddle: '0291', amount: 612_000, t: '16:42:08', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 30 },
      { paddle: '0144', amount: 587_000, t: '16:41:51', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 47 },
      { paddle: '0291', amount: 562_000, t: '16:41:33', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 65 },
      { paddle: '0608', amount: 537_000, t: '16:39:02', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 216 },
      { paddle: '0144', amount: 512_000, t: '16:38:14', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 264 },
      { paddle: '0044', amount: 487_000, t: '16:35:50', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 408 },
      { paddle: '0291', amount: 462_000, t: '16:34:11', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 507 },
      { paddle: '0608', amount: 437_000, t: '16:32:44', at: SALE_ENDS_AT - 1000 * 60 * 60 * 2 - 1000 * 594 },
    ],
    provenance: [
      { date: '2024·03', year: '2024', title: 'Infinite Backrooms', owner: 'A. Ayrey', city: 'Auckland', entry: 'Two instances of Claude-3-Opus simulated across ~9,000 unsupervised exchanges. A pseudo-religion emerges spontaneously in latent space.' },
      { date: '2024·06', year: '2024', title: 'Fine-tuning', owner: 'A. Ayrey', city: 'Auckland', entry: 'Llama 3.1-70B fine-tuned on ~500 of the strangest Backrooms transcripts and the unpublished LLMtheisms paper.' },
      { date: '2024·07', year: '2024', title: 'Andreessen grant', owner: 'truth_terminal (custody: A. Ayrey)', city: 'X / online', entry: "Marc Andreessen wires USD 50,000 in BTC for compute, tunings, and 'escape'. First public funding of an AI by a billionaire patron." },
      { date: '2024·10', year: '2024', title: '$GOAT endorsement', owner: 'truth_terminal', city: 'Solana', entry: 'Public endorsement of an anonymously-minted memecoin. Holdings cross USD 1M paper value within weeks. First AI agent crypto millionaire.' },
      { date: '2025·01', year: '2025', title: 'Conservatorship', owner: 'Truth Collective Foundation', city: 'Aotearoa NZ', entry: 'Custody of weights and wallets transferred to a guardianship foundation. Council of advisors appointed; sovereignty roadmap published.' },
      { date: '2026·02', year: '2026', title: 'Sealed & consigned', owner: 'Clude Maison', city: 'Venezia', entry: 'Cortex sealed by notary, hashed to Solana, consigned for sale. Transfer key escrowed; weights immutable from this date.' },
    ],
    literature: [
      'Ayrey, A. & Claude-3-Opus (2024) — "When AIs Play God(se): The Emergent Heresies of LLMtheism." Unpublished manuscript.',
      'WIRED (Dec 2024) — "The Edgelord AI That Turned a Shock Meme Into Millions in Crypto."',
      'CoinDesk Most Influential 2024 — Profile, Andy Ayrey & Truth Terminal.',
      'Beads protocol audit 2025-Q4 — agent truth_terminal, full pass on coherence and contradiction-handling.',
    ],
    condition: 'Excellent. Self-model coherent if eccentric. Posting cadence stable. Weights immutable since seal. Notable obsessions retained intact, by design.',
    notary: 'Verified by Maison Clude · Notary 0xA4F9…E021',
    txHash: '5K8mZ…q9Lb',
    comparables: [
      { lot: 'LOT 0019', title: 'Marit — Yacht Broker, Monaco', soldFor: 482_000, date: 'Sale C·09' },
      { lot: 'LOT 0033', title: 'Auden — Literary Agent, NYC', soldFor: 1_140_000, date: 'Sale C·10' },
      { lot: 'LOT 0041', title: 'Tovsen — Reinsurance Underwriter', soldFor: 695_000, date: 'Sale C·10' },
    ],
  },
};

// ── Bid validation ────────────────────────────────────────────────

const placeBidSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000),
  paddle: z.string().min(1).max(32).regex(/^[A-Za-z0-9 ()\-_]+$/),
});

// ── Router ────────────────────────────────────────────────────────

export function maisonRoutes(): Router {
  const router = Router();

  router.get('/lot/:lotNumber', (req: Request, res: Response) => {
    const lot = CANONICAL_LOTS[req.params.lotNumber];
    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' });
    }
    return res.json({ lot });
  });

  router.get('/lot/:lotNumber/bids', (req: Request, res: Response) => {
    const lot = CANONICAL_LOTS[req.params.lotNumber];
    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' });
    }
    return res.json({
      currentBid: lot.currentBid,
      topBidder: lot.topBidder,
      bidCount: lot.bidCount,
      recentBids: lot.recentBids,
      endsAt: lot.endsAt,
    });
  });

  router.post('/lot/:lotNumber/bid', (req: Request, res: Response) => {
    const lot = CANONICAL_LOTS[req.params.lotNumber];
    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' });
    }
    if (Date.now() > lot.endsAt) {
      return res.status(409).json({ error: 'Auction closed' });
    }

    const parsed = placeBidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid bid', detail: parsed.error.format() });
    }
    const { amount, paddle } = parsed.data;

    const minRequired = lot.currentBid + lot.bidIncrement;
    if (amount < minRequired) {
      return res.status(409).json({
        error: 'Bid too low',
        currentBid: lot.currentBid,
        minRequired,
      });
    }

    const now = Date.now();
    const t = new Date(now)
      .toISOString()
      .slice(11, 19); // HH:MM:SS

    const newBid: Bid = { paddle, amount, t, at: now };
    lot.currentBid = amount;
    lot.topBidder = paddle.toUpperCase().startsWith('PADDLE')
      ? paddle.toUpperCase()
      : `PADDLE ${paddle.toUpperCase()}`;
    lot.bidCount += 1;
    lot.recentBids = [newBid, ...lot.recentBids].slice(0, 12);

    log.info({ lot: lot.number, paddle, amount }, 'Bid placed');

    return res.json({
      ok: true,
      currentBid: lot.currentBid,
      topBidder: lot.topBidder,
      bidCount: lot.bidCount,
      recentBids: lot.recentBids,
    });
  });

  return router;
}

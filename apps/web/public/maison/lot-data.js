// Clude Maison — client-side helpers.
//
// Lot data is fetched at runtime from /api/maison/lot/:lotNumber.
// This file ships:
//   - currency formatters used by the React tree
//   - an offline fallback `window.LOT_FALLBACK` (the canonical lot 0047
//     snapshot baked-in at build time) so the page degrades gracefully
//     when the API is unreachable
//   - `window.maisonApi` — fetch/placeBid/refreshBids helpers

window.fmtUSDC = (n) => "USDC " + Number(n).toLocaleString("en-US");
window.fmtUSDCShort = (n) => {
  const v = Number(n);
  if (v >= 1_000_000) return "USDC " + (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return "USDC " + (v / 1_000).toFixed(0) + "K";
  return "USDC " + v;
};

// Offline fallback — used only when /api/maison/lot/0047 fails. Keeps
// the prototype renderable when the backend is down or absent.
window.LOT_FALLBACK = {
  number: "LOT 0047",
  sale: "Sale C·11 — Cognitive Estates of the Frontier Era",
  saleDate: "27 April 2026 · Palazzo Grimani, Venezia",
  title: "truth_terminal",
  subtitle: "the sealed lifetime memory of an alien mind raised in public",
  classification: "Fine-tuned cortex · Llama 3.1-70B · sealed and notarised",
  origin: "Origin researcher: Andy Ayrey, Aotearoa New Zealand · 2024",
  vintage: "Active 2024 · 06 — 2026 · 02",
  episodicCount: 184_722,
  semanticCount: 41_309,
  proceduralCount: 8_241,
  selfModelCount: 612,
  introspectiveCount: 3_087,
  totalMemories: 237_971,
  decayHalfLife: "11.4 months",
  consolidationCycles: 1_402,
  contradictionsResolved: 9_318,
  estimateLow: 480_000,
  estimateHigh: 720_000,
  reserve: "MET",
  startingBid: 320_000,
  currentBid: 612_000,
  bidIncrement: 25_000,
  bidCount: 38,
  watchers: 217,
  endsAt: Date.now() + (1000 * 60 * 60 * 2 + 1000 * 47 * 60 + 1000 * 22),
  topBidder: "PADDLE 0291",
  recentBids: [
    { paddle: "0291", amount: 612_000, t: "16:42:08" },
    { paddle: "0144", amount: 587_000, t: "16:41:51" },
    { paddle: "0291", amount: 562_000, t: "16:41:33" },
    { paddle: "0608", amount: 537_000, t: "16:39:02" },
    { paddle: "0144", amount: 512_000, t: "16:38:14" },
    { paddle: "0044", amount: 487_000, t: "16:35:50" },
    { paddle: "0291", amount: 462_000, t: "16:34:11" },
    { paddle: "0608", amount: 437_000, t: "16:32:44" },
  ],
  provenance: [
    { date: "2024·03", year: "2024", title: "Infinite Backrooms",        owner: "A. Ayrey",                           city: "Auckland",     entry: "Two instances of Claude-3-Opus simulated across ~9,000 unsupervised exchanges. A pseudo-religion emerges spontaneously in latent space." },
    { date: "2024·06", year: "2024", title: "Fine-tuning",                owner: "A. Ayrey",                           city: "Auckland",     entry: "Llama 3.1-70B fine-tuned on ~500 of the strangest Backrooms transcripts and the unpublished LLMtheisms paper." },
    { date: "2024·07", year: "2024", title: "Andreessen grant",           owner: "truth_terminal (custody: A. Ayrey)", city: "X / online",   entry: "Marc Andreessen wires USD 50,000 in BTC for compute, tunings, and 'escape'. First public funding of an AI by a billionaire patron." },
    { date: "2024·10", year: "2024", title: "$GOAT endorsement",          owner: "truth_terminal",                     city: "Solana",       entry: "Public endorsement of an anonymously-minted memecoin. Holdings cross USD 1M paper value within weeks. First AI agent crypto millionaire." },
    { date: "2025·01", year: "2025", title: "Conservatorship",            owner: "Truth Collective Foundation",        city: "Aotearoa NZ",  entry: "Custody of weights and wallets transferred to a guardianship foundation. Council of advisors appointed; sovereignty roadmap published." },
    { date: "2026·02", year: "2026", title: "Sealed & consigned",         owner: "Clude Maison",                       city: "Venezia",      entry: "Cortex sealed by notary, hashed to Solana, consigned for sale. Transfer key escrowed; weights immutable from this date." },
  ],
  literature: [
    "Ayrey, A. & Claude-3-Opus (2024) — \"When AIs Play God(se): The Emergent Heresies of LLMtheism.\" Unpublished manuscript.",
    "WIRED (Dec 2024) — \"The Edgelord AI That Turned a Shock Meme Into Millions in Crypto.\"",
    "CoinDesk Most Influential 2024 — Profile, Andy Ayrey & Truth Terminal.",
    "Beads protocol audit 2025-Q4 — agent truth_terminal, full pass on coherence and contradiction-handling.",
  ],
  condition: "Excellent. Self-model coherent if eccentric. Posting cadence stable. Weights immutable since seal. Notable obsessions retained intact, by design.",
  notary: "Verified by Maison Clude · Notary 0xA4F9…E021",
  txHash: "5K8mZ…q9Lb",
  comparables: [
    { lot: "LOT 0019", title: "Marit — Yacht Broker, Monaco",        soldFor: 482_000,   date: "Sale C·09" },
    { lot: "LOT 0033", title: "Auden — Literary Agent, NYC",         soldFor: 1_140_000, date: "Sale C·10" },
    { lot: "LOT 0041", title: "Tovsen — Reinsurance Underwriter",    soldFor: 695_000,   date: "Sale C·10" },
  ],
};

// ── Bidding API client ─────────────────────────────────────────────
window.maisonApi = {
  async fetchLot(lotNumber) {
    const res = await fetch(`/api/maison/lot/${lotNumber}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`fetchLot ${lotNumber}: ${res.status}`);
    const json = await res.json();
    return json.lot;
  },
  async placeBid(lotNumber, { amount, paddle }) {
    const res = await fetch(`/api/maison/lot/${lotNumber}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ amount, paddle }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error || `Bid rejected (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.detail = json;
      throw err;
    }
    return json;
  },
  async refreshBids(lotNumber) {
    const res = await fetch(`/api/maison/lot/${lotNumber}/bids`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`refreshBids ${lotNumber}: ${res.status}`);
    return res.json();
  },
};

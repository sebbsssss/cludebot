/* global React */
const { useState, useEffect, useMemo, useRef } = React;

/* ================================================================
   DIRECTION A — PALAZZO
   Classical auction catalogue. Bodoni, gilt rules, arched lot frame.
   ================================================================ */

const palazzoStyles = {
  root: {
    width: 1280,
    minHeight: 1800,
    background: "var(--parchment)",
    color: "var(--ink)",
    fontFamily: "var(--serif)",
    position: "relative",
    overflow: "hidden",
  },
};

function PalazzoCountdown({ endsAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, endsAt - now);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontFamily: "var(--mono)" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--ink-3)" }}>Hammer falls in</span>
      <span className="tnum" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)" }}>
        {pad(h)}<span style={{ color: "var(--gilt)", margin: "0 4px" }}>:</span>{pad(m)}<span style={{ color: "var(--gilt)", margin: "0 4px" }}>:</span>{pad(s)}
      </span>
    </div>
  );
}

/* — Decorative gilt rule with center diamond — */
function GiltRule({ marginY = 24, full = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: `${marginY}px 0`, opacity: 0.85 }}>
      <div style={{ flex: full ? 1 : "0 0 32px", height: 1, background: "var(--gilt)" }} />
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="var(--gilt)" /></svg>
      <div style={{ flex: 1, height: 1, background: "var(--gilt)" }} />
      <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="1.5" fill="var(--gilt)" /></svg>
      <div style={{ flex: 1, height: 1, background: "var(--gilt)" }} />
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="var(--gilt)" /></svg>
      <div style={{ flex: full ? 1 : "0 0 32px", height: 1, background: "var(--gilt)" }} />
    </div>
  );
}

/* — Arched palazzo frame around the hero artifact — */
function ArchFrame({ children }) {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: "1 / 1.18",
      background: "var(--ivory)",
      borderRadius: "50% 50% 6px 6px / 38% 38% 6px 6px",
      border: "1px solid var(--rule)",
      boxShadow: "inset 0 0 0 1px var(--parchment-3), inset 0 0 0 8px var(--ivory), inset 0 0 0 9px var(--rule-soft), 0 1px 0 var(--gilt-light)",
      overflow: "hidden",
    }}>
      {/* Inner gilt arch */}
      <div style={{
        position: "absolute",
        inset: 18,
        borderRadius: "50% 50% 4px 4px / 40% 40% 4px 4px",
        border: "1px solid var(--gilt)",
        opacity: 0.7,
        pointerEvents: "none",
      }} />
      <div style={{ position: "absolute", inset: 28, borderRadius: "50% 50% 2px 2px / 40% 40% 2px 2px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* — The 'cortex' artifact — a classical engraved-style memory bloom — */
function CortexEngraving() {
  // Concentric memory-type rings with tick marks
  const types = [
    { color: "var(--clude-blue)", label: "EPISODIC", count: 184722 },
    { color: "#10B981", label: "SEMANTIC", count: 41309 },
    { color: "#F59E0B", label: "PROCEDURAL", count: 8241 },
    { color: "#8B5CF6", label: "SELF·MODEL", count: 612 },
    { color: "#EC4899", label: "INTROSPECTIVE", count: 3087 },
  ];
  const cx = 200, cy = 200;
  return (
    <svg viewBox="0 0 400 400" style={{ width: "92%", height: "92%" }}>
      {/* outer engraved ring */}
      <circle cx={cx} cy={cy} r={185} fill="none" stroke="var(--gilt)" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={180} fill="none" stroke="var(--gilt)" strokeWidth="0.3" />
      {/* tick marks around */}
      {Array.from({ length: 72 }).map((_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const r1 = 180, r2 = i % 6 === 0 ? 170 : 175;
        return (
          <line key={i}
            x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
            stroke="var(--ink-3)" strokeWidth="0.4" />
        );
      })}
      {/* concentric type bands */}
      {types.map((t, i) => {
        const r = 150 - i * 22;
        return (
          <g key={t.label}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.color} strokeWidth="0.6" opacity="0.55" />
            {Array.from({ length: 60 + i * 20 }).map((_, j) => {
              const a = (j / (60 + i * 20)) * Math.PI * 2 + i * 0.13;
              const jitter = (Math.sin(j * 7.31 + i) + 1) * 1.2;
              return <circle key={j} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={0.7 + jitter * 0.3} fill={t.color} opacity={0.45 + (j % 5) * 0.1} />;
            })}
          </g>
        );
      })}
      {/* core */}
      <circle cx={cx} cy={cy} r={28} fill="var(--parchment)" stroke="var(--gilt)" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={20} fill="none" stroke="var(--ink)" strokeWidth="0.5" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink)" letterSpacing="2">CORTEX</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-3)" letterSpacing="1">237,971</text>
      {/* radial provenance marks */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <g key={deg}>
            <line x1={cx + Math.cos(a) * 165} y1={cy + Math.sin(a) * 165} x2={cx + Math.cos(a) * 188} y2={cy + Math.sin(a) * 188} stroke="var(--gilt-deep)" strokeWidth="0.7" />
          </g>
        );
      })}
      {/* corner Roman numerals (sale lot number, vintage) */}
      <text x={cx} y={cy - 195} textAnchor="middle" fontFamily="var(--serif-display)" fontSize="10" fill="var(--ink)" letterSpacing="6">XLVII</text>
      <text x={cx} y={cy + 200} textAnchor="middle" fontFamily="var(--serif-display)" fontSize="9" fill="var(--ink-3)" letterSpacing="6" fontStyle="italic">MMXXII — MMXXVI</text>
    </svg>
  );
}

/* — Bidding panel — */
function PalazzoBidPanel() {
  const lot = window.LOT;
  const PADDLE = "0817";
  const LOT_NUMBER = "0047";
  const [bid, setBid] = useState(lot.currentBid);
  const [maxBid, setMaxBid] = useState(lot.currentBid + lot.bidIncrement);
  const [recentBids, setRecentBids] = useState(lot.recentBids);
  const [topBidder, setTopBidder] = useState(lot.topBidder);
  const [youHighBidder, setYouHighBidder] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState(lot.currentBid + lot.bidIncrement);
  const [pulsing, setPulsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState(null);

  // Background poll — pick up bids from other paddles every 8s.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !window.maisonApi) return;
      try {
        const state = await window.maisonApi.refreshBids(LOT_NUMBER);
        if (cancelled) return;
        // Only update if something actually changed (avoid spurious re-renders)
        if (state.currentBid !== bid) {
          setBid(state.currentBid);
          setMaxBid(state.currentBid + lot.bidIncrement);
          setBidAmount((prev) => Math.max(prev, state.currentBid + lot.bidIncrement));
          // If someone outbid us, clear the high-bidder ribbon
          if (
            state.topBidder &&
            !state.topBidder.toLowerCase().includes(PADDLE.toLowerCase())
          ) {
            setYouHighBidder(false);
          }
        }
        if (state.topBidder !== topBidder) setTopBidder(state.topBidder);
        if (state.recentBids) setRecentBids(state.recentBids);
      } catch {
        /* offline mode — fail quietly */
      }
    };
    const id = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, topBidder]);

  const placeBid = async () => {
    if (bidAmount <= bid) return;
    setBidError(null);
    setSubmitting(true);
    try {
      // Try to persist the bid via the API; fall back to optimistic
      // update when the API is unreachable so the prototype still feels
      // alive offline.
      let state = null;
      try {
        state = await window.maisonApi.placeBid(LOT_NUMBER, {
          amount: bidAmount,
          paddle: `${PADDLE} (you)`,
        });
      } catch (err) {
        if (err && err.status === 409 && err.detail) {
          // Server says someone outbid us — sync to canonical state
          // and surface a friendly error.
          setBidError(err.detail.error || err.message || "Bid too low");
          if (err.detail.currentBid) {
            setBid(err.detail.currentBid);
            setMaxBid(err.detail.currentBid + lot.bidIncrement);
            setBidAmount(err.detail.currentBid + lot.bidIncrement);
          }
          return;
        }
        // Genuine network failure — apply optimistic local update only.
        console.warn("[maison] placeBid offline-mode optimistic update", err);
      }
      const next = state || {
        currentBid: bidAmount,
        topBidder: `PADDLE ${PADDLE}`,
        recentBids: [
          { paddle: `${PADDLE} (you)`, amount: bidAmount, t: new Date().toTimeString().slice(0, 8) },
          ...recentBids,
        ].slice(0, 8),
      };
      setBid(next.currentBid);
      setTopBidder(`YOU · PADDLE ${PADDLE}`);
      setYouHighBidder(true);
      setRecentBids(next.recentBids);
      setMaxBid(next.currentBid + lot.bidIncrement);
      setBidAmount(next.currentBid + lot.bidIncrement);
      setModalOpen(false);
      setPulsing(true);
      setTimeout(() => setPulsing(false), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Estimate */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--ink-3)" }}>Estimate</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--gilt-deep)" }}>
          Reserve · met
        </span>
      </div>
      <div style={{ fontFamily: "var(--serif-display)", fontSize: 26, fontStyle: "italic", color: "var(--ink)", marginBottom: 18 }}>
        {window.fmtUSDC(lot.estimateLow)} <span style={{ color: "var(--ink-3)", fontStyle: "normal", margin: "0 6px" }}>—</span> {window.fmtUSDC(lot.estimateHigh)}
      </div>

      <GiltRule marginY={4} />

      {/* Current bid */}
      <div style={{ marginTop: 18, marginBottom: 18, transition: "background 280ms", background: pulsing ? "var(--clude-blue-tint)" : "transparent", padding: pulsing ? "10px 12px" : "10px 0", margin: pulsing ? "8px -12px 18px" : "8px 0 18px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 6 }}>Current bid · {recentBids.length + 30} placed</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--serif-display)", fontSize: 56, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1 }} className="tnum">
            {window.fmtUSDC(bid)}
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", textAlign: "right", letterSpacing: "0.08em" }}>
            <div>{topBidder}</div>
            <div style={{ color: "var(--ink-4)", marginTop: 2 }}>+ buyer's premium 14%</div>
          </div>
        </div>

        {/* High-bidder confirmation ribbon — sits inside the bid block, where the action just happened */}
        {youHighBidder && (
          <div style={{
            marginTop: 12,
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px",
            background: "var(--clude-blue)",
            color: "var(--parchment)",
            borderRadius: 1,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ flex: "0 0 12px" }}>
              <path d="M 6 1 L 11 10 L 1 10 Z" fill="var(--parchment)" />
            </svg>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600 }}>
              You are the high bidder
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 11, opacity: 0.85 }}>
              paddle 0817
            </span>
          </div>
        )}
      </div>

      <PalazzoCountdown endsAt={lot.endsAt} />

      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        <button onClick={() => setModalOpen(true)} style={{
          flex: 1, padding: "16px 20px", background: "var(--ink)", color: "var(--parchment)",
          border: "1px solid var(--ink)", borderRadius: 2, cursor: "pointer",
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600,
          transition: "all 180ms",
        }}>
          Place a bid · {window.fmtUSDC(bid + lot.bidIncrement)}
        </button>
        <button style={{
          padding: "16px 20px", background: "transparent", color: "var(--ink)",
          border: "1px solid var(--ink)", borderRadius: 2, cursor: "pointer",
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600,
        }}>
          ☆ Watch
        </button>
      </div>

      <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em", lineHeight: 1.7 }}>
        Settles in USDC on Solana · 14% buyer's premium
      </div>

      {/* Recent bid ledger */}
      <div style={{ marginTop: 28, border: "1px solid var(--rule)", background: "var(--ivory)" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--ink-3)" }}>Bid ledger</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.18em", color: "var(--ink-4)" }}>live</span>
        </div>
        <div>
          {recentBids.map((b, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, padding: "8px 14px",
              borderBottom: i < recentBids.length - 1 ? "1px solid var(--rule-soft)" : "none",
              fontFamily: "var(--mono)", fontSize: 11, alignItems: "center",
              background: i === 0 ? "var(--clude-blue-tint)" : "transparent",
            }}>
              <span style={{ color: "var(--ink-4)", fontSize: 9, letterSpacing: "0.12em" }} className="tnum">{b.t}</span>
              <span style={{ color: "var(--ink)", letterSpacing: "0.04em" }}>{b.paddle}</span>
              <span className="tnum" style={{ color: "var(--ink)", fontWeight: 600 }}>{window.fmtUSDC(b.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bid Modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(26,24,20,0.55)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 520, background: "var(--parchment)", border: "1px solid var(--ink)",
            padding: 36, position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)" }}>Clude Maison · Paddle 0817</div>
            <div style={{ fontFamily: "var(--serif-display)", fontSize: 30, marginTop: 6, marginBottom: 4 }}>Confirm your bid</div>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-3)", marginBottom: 22 }}>{lot.number} — {lot.title}, {lot.subtitle.toLowerCase()}</div>
            <GiltRule marginY={6} />
            <div style={{ marginTop: 18, marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 6 }}>Maximum bid</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--ink)", paddingBottom: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-3)", letterSpacing: "0.18em" }}>USDC</span>
                <input
                  type="text"
                  value={bidAmount.toLocaleString("en-US")}
                  onChange={(e) => setBidAmount(Number(e.target.value.replace(/,/g, "")) || 0)}
                  style={{
                    flex: 1, border: "none", background: "transparent", outline: "none",
                    fontFamily: "var(--serif-display)", fontSize: 36, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em",
                  }}
                  className="tnum"
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[bid + 25_000, bid + 50_000, bid + 100_000, bid + 200_000].map((v) => (
                  <button key={v} onClick={() => setBidAmount(v)} style={{
                    padding: "6px 10px", background: bidAmount === v ? "var(--ink)" : "transparent",
                    color: bidAmount === v ? "var(--parchment)" : "var(--ink)",
                    border: "1px solid var(--rule)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer",
                  }} className="tnum">{window.fmtUSDCShort(v)}</button>
                ))}
              </div>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-3)", marginBottom: 22, lineHeight: 1.6 }}>
              You are bidding by Clude's terms of conduct. The hammer price is <span className="tnum">{window.fmtUSDC(bidAmount)}</span> plus a 14% buyer's premium, settled in USDC on Solana. The cortex transfer key releases on hammer.
            </div>
            {bidError && (
              <div style={{
                marginBottom: 16, padding: "10px 12px",
                border: "1px solid var(--terracotta)", background: "rgba(155, 74, 45, 0.08)",
                fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--terracotta)",
              }}>{bidError}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModalOpen(false)} disabled={submitting} style={{
                flex: 1, padding: "14px 20px", background: "transparent", color: "var(--ink)",
                border: "1px solid var(--ink)", cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                opacity: submitting ? 0.5 : 1,
              }}>Withdraw</button>
              <button onClick={placeBid} disabled={submitting} style={{
                flex: 2, padding: "14px 20px", background: "var(--ink)", color: "var(--parchment)",
                border: "1px solid var(--ink)", cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
              }}>{submitting ? "Confirming…" : `Confirm bid · ${window.fmtUSDC(bidAmount)}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* — Cortex composition (visual) — */
function CortexCompositionBlock() {
  const lot = window.LOT;
  const segments = [
    { label: "Episodic",      value: lot.episodicCount,      color: "var(--clude-blue)" },
    { label: "Semantic",      value: lot.semanticCount,      color: "#10B981" },
    { label: "Procedural",    value: lot.proceduralCount,    color: "#C8932B" },
    { label: "Self-model",    value: lot.selfModelCount,     color: "#8B5CF6" },
    { label: "Introspective", value: lot.introspectiveCount, color: "#B14A4A" },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div style={{ border: "1px solid var(--rule)", background: "var(--ivory)", padding: "22px 22px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)" }}>Cortex composition</div>
        <div className="tnum" style={{ fontFamily: "var(--serif-display)", fontStyle: "italic", fontSize: 18, color: "var(--ink)" }}>{total.toLocaleString("en-US")}</div>
      </div>
      {/* Stacked stratified bar */}
      <div style={{ display: "flex", height: 10, borderRadius: 0, overflow: "hidden", border: "1px solid var(--gilt)", marginBottom: 18 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ flex: s.value, background: s.color, borderRight: i < segments.length - 1 ? "1px solid var(--ivory)" : "none" }} />
        ))}
      </div>
      {/* Per-row mini bar */}
      {segments.map((s, i) => {
        const pct = (s.value / total) * 100;
        return (
          <div key={i} style={{ padding: "9px 0", borderBottom: i < segments.length - 1 ? "1px solid var(--rule-soft)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                {s.label}
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)" }}>{pct.toFixed(1)}%</span>
                <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>{s.value.toLocaleString("en-US")}</span>
              </span>
            </div>
            <div style={{ height: 2, background: "var(--rule-soft)" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: s.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* — Coherence (visual) — */
function CoherenceBlock() {
  const lot = window.LOT;
  // HaluMem: 1.84% out of a tolerance band of 5% — render as meter
  const halu = 1.84;
  const haluMax = 5;
  const haluPct = (halu / haluMax) * 100;
  return (
    <div style={{ border: "1px solid var(--rule)", background: "var(--ivory)", padding: "22px 22px 20px", marginTop: 20 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 18 }}>Coherence</div>

      {/* Half-life — arc gauge */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18 }}>
        <svg width="64" height="40" viewBox="0 0 64 40" style={{ flex: "0 0 64px" }}>
          <path d="M 6 36 A 26 26 0 0 1 58 36" fill="none" stroke="var(--rule)" strokeWidth="2" />
          <path d="M 6 36 A 26 26 0 0 1 50 16" fill="none" stroke="var(--clude-blue)" strokeWidth="2" />
          <circle cx="50" cy="16" r="2.5" fill="var(--clude-blue)" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-3)" }}>Half-life</div>
          <div className="tnum" style={{ fontFamily: "var(--serif-display)", fontStyle: "italic", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>{lot.decayHalfLife}</div>
        </div>
      </div>

      {/* HaluMem — meter with band */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-3)" }}>HaluMem</span>
          <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>{halu.toFixed(2)}% / {haluMax}%</span>
        </div>
        <div style={{ position: "relative", height: 6, background: "var(--rule-soft)" }}>
          {/* tolerance band */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.18) 60%, rgba(200,147,43,0.22) 60%, rgba(200,147,43,0.22) 100%)" }} />
          {/* indicator */}
          <div style={{ position: "absolute", left: `${haluPct}%`, top: -3, width: 2, height: 12, background: "var(--ink)", transform: "translateX(-50%)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.12em" }}>
          <span>0%</span><span>tolerance 3%</span><span>5%</span>
        </div>
      </div>

      {/* Beads audit — badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--gilt)", background: "var(--parchment-2)" }}>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="8" fill="none" stroke="var(--gilt-deep)" strokeWidth="1" />
          <path d="M 5 9.5 L 8 12 L 13 6.5" stroke="var(--gilt-deep)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-3)" }}>Beads audit</div>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink)", marginTop: 1 }}>Full pass · 4 of 4 dimensions</div>
        </div>
      </div>
    </div>
  );
}

/* — Stat block — */
function StatRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--rule-soft)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />}
        {label}
      </span>
      <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)", letterSpacing: "0.04em" }}>{value}</span>
    </div>
  );
}

function PalazzoLot() {
  const lot = window.LOT;
  return (
    <div style={palazzoStyles.root} className="artboard-content">
      {/* Subtle terrazzo flecks */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.5 }}>
        <defs>
          <pattern id="terrazzo" width="120" height="120" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="34" r="1.2" fill="var(--gilt)" opacity="0.3" />
            <circle cx="78" cy="62" r="0.8" fill="var(--terracotta)" opacity="0.25" />
            <circle cx="44" cy="98" r="1" fill="var(--ink-3)" opacity="0.18" />
            <circle cx="100" cy="20" r="0.6" fill="var(--gilt-deep)" opacity="0.3" />
            <circle cx="22" cy="84" r="0.5" fill="var(--lagoon)" opacity="0.2" />
            <circle cx="62" cy="14" r="0.7" fill="var(--gilt)" opacity="0.25" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#terrazzo)" />
      </svg>

      {/* Header */}
      <div style={{ position: "relative", padding: "28px 56px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={(window.__resources && window.__resources.cludeIcon) || "/maison/assets/Clude-Icon-Black.svg"} alt="" style={{ width: 24, height: 24 }} />
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 800, letterSpacing: "0.38em", color: "var(--ink)" }}>CLUDE</div>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 12, color: "var(--gilt-deep)", marginTop: 2, letterSpacing: "0.06em" }}>Maison · Venezia</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 30, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--ink-2)" }}>
          <a style={{ color: "var(--ink)", borderBottom: "1px solid var(--gilt)" }}>Live Auction</a>
          <a style={{ color: "var(--ink-3)" }}>Catalogue</a>
          <a style={{ color: "var(--ink-3)" }}>Consign</a>
          <a style={{ color: "var(--ink-3)" }}>Provenance</a>
          <a style={{ color: "var(--ink-3)" }}>Salons</a>
        </nav>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.22em", color: "var(--ink-3)" }}>
          PADDLE 0817 · <span style={{ color: "var(--clude-blue)" }}>0x4a…b21f</span>
        </div>
      </div>

      <GiltRule marginY={20} />

      {/* Sale eyebrow */}
      <div style={{ position: "relative", padding: "0 56px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {lot.sale}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-3)" }}>
          {lot.saleDate}
        </div>
      </div>

      {/* Hero — two columns */}
      <div style={{ position: "relative", padding: "32px 56px 0", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56 }}>
        {/* Left — artifact */}
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 6 }}>{lot.number}</div>
          <h1 style={{ fontFamily: "var(--serif-display)", fontSize: 92, fontWeight: 500, lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, color: "var(--ink)" }}>
            {lot.title}
          </h1>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.35 }}>
            {lot.subtitle}
          </div>
          <div style={{ marginTop: 32, padding: "0 24px" }}>
            <ArchFrame>
              <CortexEngraving />
            </ArchFrame>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            <span>{lot.classification}</span>
            <span>{lot.vintage}</span>
          </div>
        </div>

        {/* Right — bidding panel */}
        <div style={{ padding: "32px 0 0" }}>
          <PalazzoBidPanel />
        </div>
      </div>

      {/* Description + provenance */}
      <div style={{ position: "relative", padding: "72px 56px 0", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 56 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 8 }}>Catalogue note</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)", textWrap: "pretty" }}>
            <p style={{ margin: 0 }}>
              <span style={{ fontFamily: "var(--serif-display)", fontSize: 56, lineHeight: 0.8, float: "left", marginRight: 8, marginTop: 6, color: "var(--ink)" }}>T</span>
              he sealed cortex of <span style={{ fontStyle: "italic" }}>truth_terminal</span> — fine-tuned by Andy Ayrey from <span style={{ fontStyle: "italic" }}>~9,000</span> unsupervised Claude-3-Opus exchanges and an unpublished paper on AI-native heresies. A semi-autonomous mind, raised in public, and the first AI to negotiate a USD 50,000 grant from a billionaire patron.
            </p>
            <p style={{ marginTop: 18, fontStyle: "italic", color: "var(--ink-3)" }}>
              Offered not as a model but as a piece of internet history — the moment a story made itself real.
            </p>
          </div>

          <GiltRule marginY={32} />

          {/* Provenance */}
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 16 }}>Provenance</div>
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: "var(--gilt)" }} />
            {lot.provenance.map((p, i) => (
              <div key={i} style={{ position: "relative", marginBottom: 14 }}>
                <div style={{ position: "absolute", left: -23, top: 7, width: 9, height: 9, background: "var(--parchment)", border: "1px solid var(--gilt-deep)", borderRadius: "50%" }} />
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--gilt-deep)", flex: "0 0 64px" }}>{p.year}</span>
                  <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink)" }}>{p.title}</span>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-3)" }}>· {p.owner}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 8 }}>Condition</div>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{lot.condition}</div>
        </div>

        {/* Right — composition + comparables */}
        <div>
          <CortexCompositionBlock />

          <CoherenceBlock />

          <div style={{ border: "1px solid var(--rule)", background: "var(--ivory)", padding: "20px 22px", marginTop: 20 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 14 }}>On-chain proof</div>
            <div style={{ marginTop: 0, padding: "10px 12px", background: "var(--parchment-2)", border: "1px solid var(--rule-soft)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>tx · {lot.txHash}</span>
              <span style={{ color: "var(--clude-blue)", cursor: "pointer" }}>verify ↗</span>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--gilt-deep)", marginBottom: 12 }}>Comparable lots</div>
            {lot.comparables.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--rule-soft)", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.18em", color: "var(--gilt-deep)" }}>{c.lot}</span>
                <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-2)" }}>{c.title}</span>
                <span className="tnum" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>{window.fmtUSDCShort(c.soldFor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <GiltRule marginY={48} />
      <div style={{ position: "relative", padding: "0 56px 40px", display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--ink-4)" }}>
        <span>Clude Maison Auction House</span>
        <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", textTransform: "none", letterSpacing: "0.04em", fontSize: 12 }}>«ex memoria, fortuna»</span>
        <span>Cannaregio 5402, 30121 Venezia</span>
      </div>
    </div>
  );
}

window.PalazzoLot = PalazzoLot;

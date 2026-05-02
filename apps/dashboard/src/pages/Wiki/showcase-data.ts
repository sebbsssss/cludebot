// Rich curated dataset for /showcase/wiki — frames the page as a non-technical
// user's personal memory wiki. Topics are life domains; memories are
// conversations, observations, decisions captured by the agent across weeks.

import type { Memory } from '../../types/memory';
import type { ContradictionPair, GraphMemoryNode } from './use-wiki-data';

interface SeedRow {
  topic: string;
  source: string;
  type: Memory['memory_type'];
  importance: number;
  minutesAgo: number;
  content: string;
  summary?: string;
  compacted?: boolean;
}

const SEED: SeedRow[] = [
  // ── sleep ──
  { topic: 'sleep', source: 'morning chat', type: 'episodic', importance: 0.85, minutesAgo: 180,
    content: "slept terribly. went to bed at 1am after scrolling. woke up four times. need to actually do the no-phone-after-10 thing for real this week.",
    summary: "Bad night again — bed at 1am after phone scrolling, woke four times. The no-phone-after-10 rule keeps slipping; committing again for this week." },
  { topic: 'sleep', source: 'evening note', type: 'semantic', importance: 0.78, minutesAgo: 1440,
    content: "the week i actually kept the 10pm phone cutoff i felt totally different by friday. sharper at work, less anxious. it's not subtle.",
    summary: "When the 10pm phone cutoff is actually held, the difference by Friday is dramatic — sharper, less anxious. This is the single biggest sleep lever." },
  { topic: 'sleep', source: 'morning chat', type: 'episodic', importance: 0.62, minutesAgo: 4320,
    content: "tried magnesium glycinate before bed. fell asleep faster but woke up groggy. not sure it's worth it." },
  { topic: 'sleep', source: 'morning chat', type: 'semantic', importance: 0.71, minutesAgo: 10080,
    content: "consistent bedtime matters more than total hours. 7 hours from 11→6 beats 8 hours from 1→9. body wants the rhythm.",
    summary: "Consistent bedtime beats total hours — 7h from 11→6 feels better than 8h from 1→9. The rhythm is the lever, not the duration." },

  // ── sarahs-wedding ──
  { topic: 'sarahs-wedding', source: 'sarah text', type: 'episodic', importance: 0.92, minutesAgo: 30,
    content: "sarah confirmed pat is coming. need to RSVP +1 by friday. she also asked if we want the chicken or the fish.",
    summary: "Pat is confirmed for Sarah's wedding — RSVP +1 by Friday, plus pick chicken or fish for the meal." },
  { topic: 'sarahs-wedding', source: 'planning notes', type: 'procedural', importance: 0.81, minutesAgo: 720,
    content: "wedding is may 24 in healdsburg. driving up friday morning. need to book hotel — sarah said the inn at the river is where the bridal party is staying but the wine country inn is half the price.",
    summary: "May 24, Healdsburg. Driving up Friday morning. Two hotel options: the Inn at the River (with the bridal party, pricier) or Wine Country Inn (half the price). Decision pending." },
  { topic: 'sarahs-wedding', source: 'evening note', type: 'episodic', importance: 0.74, minutesAgo: 3000,
    content: "gift idea: that ceramic platter from heath we kept talking about. sarah and ben had registered for plates but not for serveware. 200ish, well within budget.",
    summary: "Gift decided: the Heath ceramic platter we'd talked about — registry has plates but no serveware, ~$200, within budget." },
  { topic: 'sarahs-wedding', source: 'morning chat', type: 'episodic', importance: 0.55, minutesAgo: 8640,
    content: "should i wear the navy suit or the lighter linen one. it's outdoors in may, healdsburg gets hot." },

  // ── apartment-search ──
  { topic: 'apartment-search', source: 'evening note', type: 'episodic', importance: 0.88, minutesAgo: 240,
    content: "saw the bernal heights one. great light, terrible kitchen. landlord seems flaky — took 4 days to respond. probably a no but i'm sleeping on it.",
    summary: "Bernal Heights apartment: great light, terrible kitchen, slow-responding landlord. Leaning no but sleeping on it before deciding." },
  { topic: 'apartment-search', source: 'planning notes', type: 'semantic', importance: 0.83, minutesAgo: 1080,
    content: "non-negotiables i keep coming back to: natural light (south or west exposure), in-unit washer dryer, walkable to a coffee shop. ceiling height is nice-to-have but not a deal breaker. parking doesn't matter.",
    summary: "Non-negotiables: natural light (S or W exposure), in-unit W/D, walkable coffee. Nice-to-have: ceiling height. Doesn't matter: parking." },
  { topic: 'apartment-search', source: 'morning chat', type: 'episodic', importance: 0.65, minutesAgo: 5040,
    content: "the noe valley one rented before i even saw it. that's the third time. need to be more aggressive about scheduling viewings same-day." },
  { topic: 'apartment-search', source: 'evening note', type: 'episodic', importance: 0.51, minutesAgo: 14400, compacted: true,
    content: "checked craigslist. mostly junk. zillow has been better." },

  // ── cooking ──
  { topic: 'cooking', source: 'evening note', type: 'episodic', importance: 0.79, minutesAgo: 360,
    content: "made the za'atar chicken thighs again. third time. it's officially in the rotation. crispy skin trick: pat dry, salt 30 min before, hot cast iron.",
    summary: "Za'atar chicken thighs — third time making them, officially in the rotation. Crispy skin requires: pat dry → salt 30 min ahead → hot cast iron." },
  { topic: 'cooking', source: 'morning chat', type: 'procedural', importance: 0.72, minutesAgo: 2880,
    content: "meal prep that actually worked: cook one big protein on sunday (chicken or pork shoulder), one grain (farro or rice), three veg. mix and match through the week.",
    summary: "Sunday meal prep formula: one big protein + one grain + three vegetables, mixed and matched through the week. The only version that's actually stuck." },
  { topic: 'cooking', source: 'evening note', type: 'episodic', importance: 0.58, minutesAgo: 7200,
    content: "tried the sourdough thing. four loaves in. starting to look like bread. starter is named gerald." },

  // ── reading ──
  { topic: 'reading', source: 'morning chat', type: 'semantic', importance: 0.84, minutesAgo: 480,
    content: "finished 'the death of ivan ilyich.' completely flattened me. the line about 'we are all dying, but we don't believe it' is going to live in my head for years.",
    summary: "Finished Ivan Ilyich — devastating in the best way. The line 'we are all dying, but we don't believe it' will stay with me." },
  { topic: 'reading', source: 'evening note', type: 'semantic', importance: 0.69, minutesAgo: 4320,
    content: "halfway through 'the master and his emissary.' iain mcgilchrist. left vs right brain hemispheres but it's actually about how western civilization went wrong. dense but worth it.",
    summary: "Reading McGilchrist's 'The Master and His Emissary' — left/right hemisphere thesis but really an argument about Western civilization's wrong turn. Dense, but worth the slog." },
  { topic: 'reading', source: 'evening note', type: 'episodic', importance: 0.46, minutesAgo: 20160,
    content: "didn't finish 'piranesi.' couldn't get into it despite everyone saying it's a masterpiece. moving on." },

  // ── moms-surgery ──
  { topic: 'moms-surgery', source: 'sister call', type: 'episodic', importance: 0.96, minutesAgo: 90,
    content: "mom's surgery is may 18. dr chen at UCSF. my sister is taking the first three days. i'm covering days 4-7. need to book the flight tonight.",
    summary: "Mom's surgery is May 18 with Dr Chen at UCSF. Sister covers days 1–3, I cover days 4–7. Flight needs to be booked tonight." },
  { topic: 'moms-surgery', source: 'evening note', type: 'episodic', importance: 0.87, minutesAgo: 1440,
    content: "talked to mom. she's scared but pretending not to be. just listened mostly. she said the thing she's most worried about is being a burden after, which broke my heart a little.",
    summary: "Mom's main worry is being 'a burden' after surgery — not the surgery itself. Be ready to push back on that gently in the recovery week." },
  { topic: 'moms-surgery', source: 'planning notes', type: 'procedural', importance: 0.79, minutesAgo: 4320,
    content: "things to organize before going: groceries delivered to her place, ride from the airport, work let know i'm OOO, phone charger for the hospital, the soft pillow she likes.",
    summary: "Pre-departure checklist: groceries delivered to mom's, airport ride sorted, work OOO notice, phone charger, the soft pillow she likes." },

  // ── career ──
  { topic: 'career', source: 'evening note', type: 'semantic', importance: 0.86, minutesAgo: 540,
    content: "the longer i think about it, the more i don't want to be a manager. i like building. the path everyone keeps pushing me toward is exactly the one i don't want.",
    summary: "Recurring thought: I don't want to be a manager. I want to keep building. The default path everyone assumes I'm on isn't the one I want." },
  { topic: 'career', source: 'morning chat', type: 'episodic', importance: 0.72, minutesAgo: 3600,
    content: "lunch with maya. she made the staff engineer transition without going into management. her take: it requires being LOUD about what you're doing. write more, present more, claim scope.",
    summary: "Maya's advice on the staff-without-management path: be LOUD about your work — write, present, claim scope. The work alone isn't visible enough." },
  { topic: 'career', source: 'evening note', type: 'episodic', importance: 0.58, minutesAgo: 14400,
    content: "felt great after that talk i gave at the team offsite. that's the kind of work i want more of. why do i not do more of it." },

  // ── money ──
  { topic: 'money', source: 'planning notes', type: 'semantic', importance: 0.81, minutesAgo: 720,
    content: "decided: 20% of every paycheck to index funds, automatic on the 1st. 10% to the apartment-down-payment savings. rest to checking. stop overthinking the asset allocation.",
    summary: "Auto-allocation set: 20% paycheck → index funds (on the 1st), 10% → apartment fund, rest → checking. Stop overthinking allocations — consistency beats optimization." },
  { topic: 'money', source: 'morning chat', type: 'episodic', importance: 0.67, minutesAgo: 4320,
    content: "the new mac was $3400. that's 4 months of apartment savings. it was the right call for work but i should sit with that number for a minute." },
];

function memoryFrom(seed: SeedRow, idx: number): Memory {
  const createdAt = new Date(Date.now() - seed.minutesAgo * 60_000).toISOString();
  return {
    id: 10000 + idx,
    hash_id: `clude-${('0000' + idx).slice(-4)}`,
    memory_type: seed.type,
    content: seed.content,
    summary: seed.summary ?? seed.content,
    tags: [seed.topic],
    concepts: [],
    emotional_valence: 0,
    importance: seed.importance,
    access_count: Math.floor(Math.random() * 12),
    source: seed.source,
    source_id: null,
    related_user: null,
    related_wallet: null,
    metadata: {},
    created_at: createdAt,
    last_accessed: createdAt,
    decay_factor: seed.compacted ? 0.4 : Math.max(0.5, 0.99 - seed.minutesAgo / 200000),
    evidence_ids: [],
    solana_signature: null,
    compacted: seed.compacted ?? false,
    compacted_into: null,
  };
}

export const SHOWCASE_MEMORIES: Memory[] = SEED.map(memoryFrom);

// Curated contradiction: the apartment-search hotel choice surfaced an internal
// disagreement between "stay with the bridal party" and "save half the cost."
// Synthetic but uses two real seeded memories.
export const SHOWCASE_CONTRADICTIONS: ContradictionPair[] = (() => {
  const aIdx = SEED.findIndex((s) => s.topic === 'sleep' && s.minutesAgo === 4320);
  const bIdx = SEED.findIndex((s) => s.topic === 'sleep' && s.minutesAgo === 1440);
  if (aIdx < 0 || bIdx < 0) return [];
  const a = SHOWCASE_MEMORIES[aIdx];
  const b = SHOWCASE_MEMORIES[bIdx];
  const toGraphNode = (m: Memory): GraphMemoryNode => ({
    id: m.id,
    type: m.memory_type,
    summary: m.summary,
    content: m.content,
    tags: m.tags,
    importance: m.importance,
    source: m.source,
    createdAt: m.created_at,
  });
  return [{ a: toGraphNode(a), b: toGraphNode(b), strength: 0.78 }];
})();

export const SHOWCASE_TOPIC_COUNTS: Record<string, number> = SEED.reduce((acc, s) => {
  acc[s.topic] = (acc[s.topic] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

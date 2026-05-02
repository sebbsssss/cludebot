// Mock data for the Brain Wiki page.
// Persona: developers running agents — both their own thinking and the agent's thought-process.
// Replace any of these arrays with real API calls (api.recall, api.entities, api.fragments)
// when the Wiki is wired to live data.

export type Cluster = 'architecture' | 'research' | 'product' | 'self';
export type FragmentStatus = 'pending' | 'synthesized' | 'conflict' | 'archived';
export type FragmentActor = 'agent' | 'user';
export type BondKind =
  | 'causes'
  | 'supports'
  | 'elaborates'
  | 'contradicts'
  | 'relates'
  | 'follows';

export interface Topic {
  id: string;
  name: string;
  cluster: Cluster;
  color: string;
  count: number;
  summary: string;
}

export interface Entity {
  id: string;
  name: string;
  kind: 'person' | 'agent' | 'project' | 'tool';
  cluster: Cluster;
  color: string;
}

export interface Fragment {
  id: string;
  source: string;
  actor: FragmentActor;
  time: string;
  status: FragmentStatus;
  raw: string;
  reframed: string | null;
  topic: string | null;
  confidence: number;
  // Numeric memory id when sourced from live data; absent for mocks.
  memoryId?: number;
  // ISO timestamp when sourced from live data; absent for mocks.
  memoryCreatedAt?: string;
}

export interface ArticleMeta {
  sources: number;
  updated: string;
  contributors: number;
  confidence: number;
}

export interface Article {
  id: string;
  title: string;
  cluster: Cluster;
  color: string;
  lede: string;
  meta: ArticleMeta;
  sections: { id: string; title: string }[];
}

export interface Backlink {
  id: string;
  title: string;
  color: string;
  snip: string;
}

export interface RecentEdit {
  icon: string;
  text: string;
  time: string;
}

export interface GraphNode {
  id: string;
  label: string;
  cluster: Cluster;
  x: number;
  y: number;
  r: number;
  weight: number;
  kind?: 'entity';
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: BondKind;
  weight: number;
}

export interface Contradiction {
  topic: string;
  a: string;
  aSrc: string;
  b: string;
  bSrc: string;
  suggestion: string;
  // Numeric memory ids when sourced from live data; absent for mocks.
  // `aId` is the older side, `bId` the newer (mirrors `extractContradictions` sort).
  aId?: number;
  bId?: number;
}

export const TOPICS: Topic[] = [
  { id: 'memory-decay',     name: 'Memory Decay',                cluster: 'architecture', color: '#2244FF', count: 24, summary: "Differential decay rates per memory type; the math, the rationale, and what the agent should treat as 'cold'." },
  { id: 'agent-loops',      name: 'Agent Loops',                 cluster: 'architecture', color: '#2244FF', count: 18, summary: "How the agent's plan→act→reflect cycle accumulates state across runs." },
  { id: 'user-frustrations',name: 'User Frustrations',           cluster: 'product',      color: '#10B981', count: 12, summary: "Recurring complaints from the developer's own session logs and Cludebot's 1-line postmortems." },
  { id: 'billing-design',   name: 'Billing Model',               cluster: 'product',      color: '#10B981', count: 9,  summary: 'Per-token vs per-memory; the founder vs CTO tension surfaced across three threads.' },
  { id: 'halumem-bench',    name: 'HaluMem Benchmark',           cluster: 'research',     color: '#F59E0B', count: 31, summary: '1.96% hallucination, run methodology, and where the next-best system breaks.' },
  { id: 'stanford-agents',  name: 'Stanford Generative Agents',  cluster: 'research',     color: '#F59E0B', count: 7,  summary: "Notes from re-reading the paper; what mapped onto Clude's design and what didn't." },
  { id: 'founder-burnout',  name: 'Founder Burnout',             cluster: 'self',         color: '#8B5CF6', count: 5,  summary: 'Personal — the agent has noticed three Friday-night patterns. Tagged self_model so it survives consolidation.' },
  { id: 'shipping-rituals', name: 'Shipping Rituals',            cluster: 'self',         color: '#8B5CF6', count: 8,  summary: 'What you do before/after every ship; the agent has started suggesting these unprompted.' },
];

export const ENTITIES: Entity[] = [
  { id: 'seb',            name: 'Seb',            kind: 'person',  cluster: 'self',         color: '#8B5CF6' },
  { id: 'anya',           name: 'Anya',           kind: 'person',  cluster: 'product',      color: '#10B981' },
  { id: 'cludebot',       name: '@Cludebot',      kind: 'agent',   cluster: 'architecture', color: '#2244FF' },
  { id: 'research-agent', name: 'research-agent', kind: 'agent',   cluster: 'architecture', color: '#2244FF' },
  { id: 'halumem',        name: 'HaluMem',        kind: 'project', cluster: 'research',     color: '#F59E0B' },
  { id: 'memgpt',         name: 'MemGPT/Letta',   kind: 'project', cluster: 'research',     color: '#F59E0B' },
  { id: 'claude-code',    name: 'Claude Code',    kind: 'tool',    cluster: 'architecture', color: '#2244FF' },
];

export const FRAGMENTS: Fragment[] = [
  {
    id: 'f-001', source: '@Cludebot', actor: 'agent', time: '12m ago', status: 'synthesized',
    raw: 'user asked again about decay. third time this week. they keep wanting to know if procedural decays slower than episodic. i should write this down properly somewhere.',
    reframed: 'Procedural memories decay at 3%/day vs. episodic 7%/day. Seb has asked this three times this week — strong signal this should be surfaced in the SDK README, not buried in API docs.',
    topic: 'memory-decay',
    confidence: 0.91,
  },
  {
    id: 'f-002', source: 'research-agent', actor: 'agent', time: '34m ago', status: 'conflict',
    raw: "anya said 'we'll charge per memory stored'. but seb's 11pm note said per-token usage. these are different.",
    reframed: "Pricing model conflict surfaced: Anya proposed per-memory billing (Tue standup); Seb's 11pm planning doc specifies per-token. Needs decision before Friday's investor call.",
    topic: 'billing-design',
    confidence: 0.88,
  },
  {
    id: 'f-003', source: 'Seb', actor: 'user', time: '1h ago', status: 'pending',
    raw: 'the brain map should feel less like a graph and more like a notebook with edges. obsidian gets it almost right but the edges are decorative not functional.',
    reframed: null,
    topic: null,
    confidence: 0.62,
  },
  {
    id: 'f-004', source: '@Cludebot', actor: 'agent', time: '2h ago', status: 'synthesized',
    raw: 'halumem run #847 done. 1.96%. next best (mem0): 15.2%. i think this is the lead number for any deck.',
    reframed: 'HaluMem run #847 complete: Clude 1.96% hallucination, next best 15.2% (Mem0). This delta — ~7.7× — is the headline metric for the pitch deck and the SDK README.',
    topic: 'halumem-bench',
    confidence: 0.97,
  },
  {
    id: 'f-005', source: 'Seb', actor: 'user', time: '3h ago', status: 'pending',
    raw: 'tired. third friday in a row debugging the same edge case in the consolidation pass. something is structurally off.',
    reframed: null,
    topic: null,
    confidence: 0.71,
  },
  {
    id: 'f-006', source: 'research-agent', actor: 'agent', time: '4h ago', status: 'synthesized',
    raw: 're-read stanford generative agents (park 2023). their reflection step uses LLM to summarize top-N most-important memories. we do this in dream cycle but with importance × recency × relevance. our weighting is more principled.',
    reframed: "Stanford's Generative Agents (Park et al. 2023) reflects on top-N important memories via LLM summarization. Clude's Dream Cycle uses importance × recency × relevance — a weighted retrieval rather than a flat top-N. The two approaches converge on the same goal but Clude's is more principled.",
    topic: 'stanford-agents',
    confidence: 0.94,
  },
  {
    id: 'f-007', source: 'Seb', actor: 'user', time: '5h ago', status: 'synthesized',
    raw: 'every time i ship i write the changelog AFTER and it sucks. write it during.',
    reframed: "Shipping ritual: write changelog DURING the work, not after. Retroactive changelogs lose the 'why'. The agent has noticed this pattern across three releases.",
    topic: 'shipping-rituals',
    confidence: 0.83,
  },
  {
    id: 'f-008', source: '@Cludebot', actor: 'agent', time: '6h ago', status: 'archived',
    raw: 'test memory please ignore',
    reframed: null,
    topic: null,
    confidence: 0.04,
  },
  {
    id: 'f-009', source: 'research-agent', actor: 'agent', time: '7h ago', status: 'synthesized',
    raw: 'memgpt/letta has hierarchical memory with main/external context. paged in/out by LLM. similar to OS virtual memory. our typed memory is different — we don\'t page, we decay. tradeoff: simpler retrieval, less precise control.',
    reframed: "MemGPT/Letta uses hierarchical paged memory (main/external), LLM-controlled like OS virtual memory. Clude's typed differential decay is a different axis — simpler retrieval, less precise control. Worth naming this tradeoff explicitly in the docs.",
    topic: 'stanford-agents',
    confidence: 0.89,
  },
];

export const WIKI_ARTICLE: Article = {
  id: 'memory-decay',
  title: 'Memory Decay',
  cluster: 'architecture',
  color: '#2244FF',
  lede: "How Clude forgets — on purpose. Differential decay per memory type, why those numbers, and what 'cold' means in retrieval.",
  meta: { sources: 24, updated: '12m ago', contributors: 3, confidence: 0.94 },
  sections: [
    { id: 'overview',  title: 'Overview' },
    { id: 'rates',     title: 'Decay Rates' },
    { id: 'rationale', title: 'Why These Rates' },
    { id: 'retrieval', title: 'Retrieval Behavior' },
    { id: 'open',      title: 'Open Questions' },
  ],
};

export const BACKLINKS: Backlink[] = [
  { id: 'agent-loops',       title: 'Agent Loops',                 color: '#2244FF', snip: '…the loop reads decay before deciding to recall…' },
  { id: 'halumem-bench',     title: 'HaluMem Benchmark',           color: '#F59E0B', snip: '…decay tuning was the dominant factor in the 1.96% number…' },
  { id: 'shipping-rituals',  title: 'Shipping Rituals',            color: '#8B5CF6', snip: '…ship-day notes get importance × 1.4 to resist decay…' },
  { id: 'stanford-agents',   title: 'Stanford Generative Agents',  color: '#F59E0B', snip: '…Park et al. reflect, we decay — converging goals…' },
  { id: 'user-frustrations', title: 'User Frustrations',           color: '#10B981', snip: '…Seb has asked about decay rates 3 times this week…' },
];

export const RECENT_EDITS: RecentEdit[] = [
  { icon: '+', text: 'Reframed fragment from <strong>@Cludebot</strong> into <strong>Decay Rates</strong>', time: '12m' },
  { icon: '↗', text: '<strong>HaluMem Benchmark</strong> linked here as supporting evidence', time: '1h' },
  { icon: '⚠', text: 'Contradiction flagged: episodic 7%/day vs old note (5%/day)', time: '2h' },
  { icon: '✓', text: '<strong>Seb</strong> accepted reframe in <strong>Why These Rates</strong>', time: '5h' },
  { icon: '◇', text: '<strong>research-agent</strong> consolidated 4 fragments into this article', time: '1d' },
  { icon: '+', text: 'New section: <strong>Open Questions</strong>', time: '2d' },
];

export const GRAPH_NODES: GraphNode[] = [
  { id: 'memory-decay',      label: 'Memory Decay',      cluster: 'architecture', x: 480, y: 320, r: 32, weight: 24 },
  { id: 'agent-loops',       label: 'Agent Loops',       cluster: 'architecture', x: 600, y: 220, r: 26, weight: 18 },
  { id: 'cludebot',          label: '@Cludebot',         cluster: 'architecture', x: 380, y: 180, r: 18, weight: 14, kind: 'entity' },
  { id: 'research-agent',    label: 'research-agent',    cluster: 'architecture', x: 280, y: 260, r: 18, weight: 11, kind: 'entity' },
  { id: 'halumem-bench',     label: 'HaluMem',           cluster: 'research',     x: 720, y: 380, r: 34, weight: 31 },
  { id: 'stanford-agents',   label: 'Stanford Agents',   cluster: 'research',     x: 820, y: 280, r: 22, weight: 7 },
  { id: 'memgpt',            label: 'MemGPT/Letta',      cluster: 'research',     x: 760, y: 180, r: 18, weight: 9, kind: 'entity' },
  { id: 'user-frustrations', label: 'User Frustrations', cluster: 'product',      x: 360, y: 460, r: 22, weight: 12 },
  { id: 'billing-design',    label: 'Billing Model',     cluster: 'product',      x: 240, y: 400, r: 20, weight: 9 },
  { id: 'anya',              label: 'Anya',              cluster: 'product',      x: 180, y: 480, r: 16, weight: 6, kind: 'entity' },
  { id: 'founder-burnout',   label: 'Founder Burnout',   cluster: 'self',         x: 580, y: 500, r: 18, weight: 5 },
  { id: 'shipping-rituals',  label: 'Shipping Rituals',  cluster: 'self',         x: 700, y: 540, r: 22, weight: 8 },
  { id: 'seb',               label: 'Seb',               cluster: 'self',         x: 480, y: 580, r: 20, weight: 12, kind: 'entity' },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { source: 'memory-decay',      target: 'agent-loops',       kind: 'supports',    weight: 0.9 },
  { source: 'memory-decay',      target: 'halumem-bench',     kind: 'supports',    weight: 0.85 },
  { source: 'memory-decay',      target: 'user-frustrations', kind: 'elaborates',  weight: 0.6 },
  { source: 'memory-decay',      target: 'stanford-agents',   kind: 'relates',     weight: 0.55 },
  { source: 'memory-decay',      target: 'shipping-rituals',  kind: 'relates',     weight: 0.4 },
  { source: 'agent-loops',       target: 'cludebot',          kind: 'relates',     weight: 0.7 },
  { source: 'agent-loops',       target: 'research-agent',    kind: 'relates',     weight: 0.7 },
  { source: 'halumem-bench',     target: 'stanford-agents',   kind: 'elaborates',  weight: 0.7 },
  { source: 'halumem-bench',     target: 'memgpt',            kind: 'contradicts', weight: 0.5 },
  { source: 'stanford-agents',   target: 'memgpt',            kind: 'elaborates',  weight: 0.6 },
  { source: 'user-frustrations', target: 'billing-design',    kind: 'causes',      weight: 0.5 },
  { source: 'billing-design',    target: 'anya',              kind: 'relates',     weight: 0.6 },
  { source: 'billing-design',    target: 'seb',               kind: 'contradicts', weight: 0.6 },
  { source: 'founder-burnout',   target: 'seb',               kind: 'relates',     weight: 0.8 },
  { source: 'founder-burnout',   target: 'shipping-rituals',  kind: 'causes',      weight: 0.5 },
  { source: 'shipping-rituals',  target: 'seb',               kind: 'relates',     weight: 0.7 },
  { source: 'seb',               target: 'user-frustrations', kind: 'relates',     weight: 0.6 },
  { source: 'cludebot',          target: 'memory-decay',      kind: 'supports',    weight: 0.7 },
  { source: 'research-agent',    target: 'stanford-agents',   kind: 'supports',    weight: 0.65 },
];

export const CLUSTER_COLORS: Record<Cluster, string> = {
  architecture: '#2244FF',
  research:     '#F59E0B',
  product:      '#10B981',
  self:         '#8B5CF6',
};

export const CLUSTER_LABELS: Record<Cluster, string> = {
  architecture: 'Architecture',
  research:     'Research',
  product:      'Product',
  self:         'Self / Founder',
};

export const BOND_COLORS: Record<BondKind, string> = {
  causes:      '#EF4444',
  supports:    '#2244FF',
  elaborates:  '#10B981',
  contradicts: '#F59E0B',
  relates:     '#9CA3AF',
  follows:     '#A3A3A3',
};

export const CONTRADICTIONS: Contradiction[] = [
  {
    topic: 'Memory Decay',
    a: 'Episodic decays 5%/day',
    aSrc: 'old README · 18d ago',
    b: 'Episodic decays 7%/day',
    bSrc: '@Cludebot · 12m ago',
    suggestion: 'Adopt 7%/day — recent benchmark data supports it.',
  },
];

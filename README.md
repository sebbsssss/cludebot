# Clude Bot

Persistent memory SDK for AI agents. Give your agent a brain that remembers, learns, and dreams.

Built on [Stanford Generative Agents](https://arxiv.org/abs/2304.03442) (Park et al. 2023), [MemGPT/Letta](https://arxiv.org/abs/2310.08560), [CoALA](https://arxiv.org/abs/2309.02427), [Beads](https://github.com/steveyegge/beads) (compaction + hash IDs), and [Venice](https://venice.ai) (permissionless inference).

```bash
npm install clude-bot
```

## Quick Start

```typescript
import { Cortex } from 'clude-bot';

const brain = new Cortex({
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_KEY!,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
});

await brain.init();

// Store a memory
await brain.store({
  type: 'episodic',
  content: 'User asked about pricing and seemed frustrated with the current plan.',
  summary: 'Frustrated user asking about pricing',
  tags: ['pricing', 'user-concern'],
  importance: 0.7,
  source: 'my-agent',
  relatedUser: 'user-123',
});

// Recall relevant memories
const memories = await brain.recall({
  query: 'what do users think about pricing',
  limit: 5,
});

// Format for your LLM prompt
const context = brain.formatContext(memories);
// Pass `context` into your system prompt so the LLM knows what it remembers
```

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project.

### 2. Run the schema

Open the SQL Editor in your Supabase dashboard and paste the contents of `supabase-schema.sql`:

```bash
# Find the schema file
cat node_modules/clude-bot/supabase-schema.sql
```

Or let `brain.init()` attempt auto-creation (requires an `exec_sql` RPC function in your Supabase project).

### 3. Enable extensions

In your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 4. Get your keys

- **Supabase URL + service key**: Project Settings > API
- **Anthropic API key**: [console.anthropic.com](https://console.anthropic.com) (optional for basic store/recall, required for dream cycles)
- **Voyage AI or OpenAI key**: For vector search (optional, falls back to keyword scoring)

---

## API Reference

### Constructor

```typescript
const brain = new Cortex({
  // Required
  supabase: {
    url: string,
    serviceKey: string,
  },

  // Optional — required for dream cycles and LLM importance scoring
  anthropic: {
    apiKey: string,
    model?: string,     // default: 'claude-opus-4-6'
  },

  // Optional — enables vector similarity search
  embedding: {
    provider: 'voyage' | 'openai',
    apiKey: string,
    model?: string,     // default: voyage-3-lite / text-embedding-3-small
    dimensions?: number, // default: 1024
  },

  // Optional — commits memory hashes to Solana
  solana: {
    rpcUrl?: string,
    botWalletPrivateKey?: string,
  },
});
```

### `brain.init()`

Initialize the database schema. Call once before any other operation.

```typescript
await brain.init();
```

### `brain.store(opts)`

Store a new memory. Returns the memory ID or `null`.

```typescript
const id = await brain.store({
  type: 'episodic',        // 'episodic' | 'semantic' | 'procedural' | 'self_model'
  content: 'Full content of the memory...',
  summary: 'Brief summary',
  source: 'my-agent',
  tags: ['user', 'question'],
  importance: 0.7,          // 0-1, or omit for LLM-based scoring
  relatedUser: 'user-123',  // optional — enables per-user recall
  emotionalValence: 0.3,    // optional — -1 (negative) to 1 (positive)
  evidenceIds: [42, 43],    // optional — link to source memories
});
```

**Memory types:**

| Type | Decay/day | Use for |
|------|-----------|---------|
| `episodic` | 7% | Raw interactions, conversations, events |
| `semantic` | 2% | Learned knowledge, patterns, insights |
| `procedural` | 3% | Behavioral rules, what works/doesn't |
| `self_model` | 1% | Identity, self-understanding |

### `brain.recall(opts)`

Recall memories using hybrid scoring (vector similarity + keyword matching + tag overlap + importance + association graph).

```typescript
const memories = await brain.recall({
  query: 'what happened with user-123',
  tags: ['pricing'],
  relatedUser: 'user-123',
  memoryTypes: ['episodic', 'semantic'],
  limit: 10,
  minImportance: 0.3,
});
```

Scoring formula (Park et al. 2023):
```
score = (0.5 * recency + 3.0 * relevance + 2.0 * importance + 3.0 * vector + 1.5 * graph) * decay
```

Recalled memories get their access count incremented and decay reset. Co-retrieved memories strengthen their association links (Hebbian learning).

### `brain.recallSummaries(opts)`

Token-efficient recall — returns lightweight summaries (~50 tokens each) instead of full content.

```typescript
const summaries = await brain.recallSummaries({ query: 'recent events' });
// Each has: id, summary, type, tags, concepts, importance, decay, created_at
```

### `brain.hydrate(ids)`

Fetch full content for specific memory IDs. Use with `recallSummaries` for progressive disclosure.

```typescript
const summaries = await brain.recallSummaries({ query: 'important' });
const topIds = summaries.slice(0, 3).map(s => s.id);
const full = await brain.hydrate(topIds);
```

### `brain.dream(opts?)`

Run one dream cycle: consolidation, reflection, emergence. Requires `anthropic` config.

```typescript
await brain.dream({
  onEmergence: async (thought) => {
    console.log('Agent thought:', thought);
    // Post to Discord, save to file, etc.
  },
});
```

**Three phases:**
1. **Consolidation** — generates focal-point questions from recent memories, synthesizes evidence-linked insights
2. **Reflection** — reviews accumulated knowledge, updates self-model with evidence citations
3. **Emergence** — introspective synthesis, output sent to `onEmergence` callback

### `brain.startDreamSchedule()` / `brain.stopDreamSchedule()`

Automated dream cycles every 6 hours + daily memory decay at 3am UTC. Also triggers on accumulated importance (event-driven reflection).

```typescript
brain.startDreamSchedule();
// ... later
brain.stopDreamSchedule();
```

### `brain.link(sourceId, targetId, type, strength?)`

Create a typed association between two memories.

```typescript
await brain.link(42, 43, 'supports', 0.8);
```

Link types: `'supports'` | `'contradicts'` | `'elaborates'` | `'causes'` | `'follows'` | `'relates'`

### `brain.decay()`

Manually trigger memory decay. Each type decays at its own rate per day.

```typescript
const decayed = await brain.decay();
console.log(`${decayed} memories decayed`);
```

### `brain.stats()`

Get memory system statistics.

```typescript
const stats = await brain.stats();
// { total, byType, avgImportance, avgDecay, totalDreamSessions, ... }
```

### `brain.recent(hours, types?, limit?)`

Get recent memories from the last N hours.

```typescript
const last24h = await brain.recent(24);
const recentInsights = await brain.recent(168, ['semantic'], 10);
```

### `brain.selfModel()`

Get the agent's current self-model memories.

```typescript
const identity = await brain.selfModel();
```

### `brain.formatContext(memories)`

Format memories into a markdown string for LLM prompt injection.

```typescript
const memories = await brain.recall({ query: userMessage });
const context = brain.formatContext(memories);

// Use in your LLM call:
const response = await anthropic.messages.create({
  system: `You are a helpful agent.\n\n## Memory\n${context}`,
  messages: [{ role: 'user', content: userMessage }],
});
```

### `brain.inferConcepts(summary, source, tags)`

Auto-classify memory content into structured concepts.

```typescript
const concepts = brain.inferConcepts('User frustrated about pricing', 'chat', ['pricing']);
// ['holder_behavior', 'sentiment_shift']
```

### `brain.on(event, handler)`

Listen for memory events.

```typescript
brain.on('memory:stored', ({ importance, memoryType }) => {
  console.log(`New ${memoryType} memory stored (importance: ${importance})`);
});
```

### `brain.destroy()`

Stop dream schedules, clean up event listeners.

---

## Graceful Degradation

The SDK works with minimal config and progressively enhances:

| Feature | Without it |
|---------|------------|
| `anthropic` not set | LLM importance scoring falls back to rules. `dream()` throws. |
| `embedding` not set | Vector search disabled, recall uses keyword + tag scoring only. |
| `solana` not set | On-chain memory commits silently skipped. |

**Minimum viable setup** — just Supabase:
```typescript
const brain = new Cortex({
  supabase: { url: '...', serviceKey: '...' },
});
```

This gives you full store/recall/decay with keyword-based retrieval. Add Anthropic for dream cycles, add embeddings for vector search.

---

## Example: Chat Agent with Memory

```typescript
import { Cortex } from 'clude-bot';
import Anthropic from '@anthropic-ai/sdk';

const brain = new Cortex({
  supabase: { url: process.env.SUPABASE_URL!, serviceKey: process.env.SUPABASE_KEY! },
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  embedding: { provider: 'voyage', apiKey: process.env.VOYAGE_API_KEY! },
});
await brain.init();
brain.startDreamSchedule();

const anthropic = new Anthropic();

async function handleMessage(userId: string, message: string): Promise<string> {
  // Recall relevant memories
  const memories = await brain.recall({
    query: message,
    relatedUser: userId,
    limit: 5,
  });

  // Generate response with memory context
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system: `You are a helpful assistant.\n\n## What you remember\n${brain.formatContext(memories)}`,
    messages: [{ role: 'user', content: message }],
  });

  const reply = response.content[0].type === 'text' ? response.content[0].text : '';

  // Store this interaction as a memory
  await brain.store({
    type: 'episodic',
    content: `User (${userId}): ${message}\nAssistant: ${reply}`,
    summary: `Conversation with ${userId} about ${message.slice(0, 50)}`,
    source: 'chat',
    relatedUser: userId,
    tags: brain.inferConcepts(message, 'chat', []),
  });

  return reply;
}
```

---

## How It Works

### Memory Retrieval

Hybrid scoring combines multiple signals (Park et al. 2023):

- **Recency**: `0.995^hours` exponential decay since last access
- **Relevance**: Keyword trigram similarity + tag overlap
- **Importance**: LLM-scored 1-10, normalized to 0-1
- **Vector similarity**: Cosine similarity via pgvector HNSW indexes
- **Graph boost**: Association link strength between co-retrieved memories

Recalled memories get reinforced — access count increments, decay resets, and co-retrieved memories strengthen their links (Hebbian learning).

### Memory Decay

Each type persists at a different rate, mimicking biological memory:

- **Episodic** (0.93/day): Events fade quickly unless reinforced
- **Semantic** (0.98/day): Knowledge persists
- **Procedural** (0.97/day): Behavioral patterns are stable
- **Self-model** (0.99/day): Identity is nearly permanent

### Hash-Based IDs (Beads-inspired)

Every memory gets a collision-resistant ID like `clude-a1b2c3d4`:

- **No merge conflicts**: Multiple agents can create memories simultaneously without ID collisions
- **Stable references**: IDs survive database migrations and replication
- **Human-readable**: Easy to reference in logs and debugging

### Memory Compaction (Beads-inspired)

Old, faded memories get summarized to save context window space:

**Criteria for compaction:**
- Memory is older than 7 days
- Decay factor < 0.3 (faded from disuse)
- Importance < 0.5 (not critical)
- Only episodic memories (insights and self-model are preserved)

**Process:**
1. Group candidates by concept
2. Generate semantic summary for each group
3. Store summary with evidence links to originals
4. Mark originals as compacted

This mimics how human memory consolidates — details fade, patterns persist.

### Dream Cycles

Four-phase introspection process:

1. **Consolidation**: Generates focal-point questions from recent episodic memories, retrieves relevant context, synthesizes evidence-linked semantic insights
2. **Compaction**: Summarizes old faded memories into dense semantic summaries (Beads-inspired)
3. **Reflection**: Reviews self-model + semantic memories, produces self-observations with evidence citations
4. **Emergence**: Introspective synthesis — the agent examines its own existence

### Permissionless Inference (Venice)

Clude supports [Venice](https://venice.ai) as a decentralized inference provider:

```typescript
const brain = new Cortex({
  supabase: { ... },
  venice: {
    apiKey: process.env.VENICE_API_KEY,
    model: 'llama-3.3-70b',  // or deepseek-r1, qwen, etc.
  },
  inference: {
    primary: 'venice',     // Use Venice first
    fallback: 'anthropic', // Fall back to Claude if needed
  },
});
```

**Why Venice?**
- **Permissionless**: No approval process, no rate limits
- **Private**: No data retention — your prompts stay yours
- **Decentralized**: Matches Clude's on-chain memory philosophy
- **Multi-model**: Access Claude, GPT, Llama, DeepSeek, and more

Set `INFERENCE_PRIMARY=venice` and `VENICE_API_KEY` to use Venice by default.

### Association Graph

Typed, weighted links between memories:
- `supports`, `contradicts`, `elaborates`, `causes`, `follows`, `relates`
- Auto-linked on storage via embedding similarity
- Strengthened through co-retrieval (Hebbian learning)
- Boosts recall scores for connected memories

---

## Running the Clude Bot

This package also includes the full Clude bot — an autonomous AI agent on X ([@Cludebot](https://x.com/Cludebot)).

```bash
git clone https://github.com/sebbsssss/cludebot.git
cd cludebot
npm install
cp .env.example .env  # fill in API keys
npm run dev
```

See `.env.example` for required environment variables (X API, Supabase, Anthropic, Helius).

---

## Stack

TypeScript, Supabase (PostgreSQL + pgvector), Anthropic Claude, Voyage AI / OpenAI embeddings, Solana Web3.js, Node.js.

## License

MIT

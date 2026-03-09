# Integrating Clude Memory Into Your Agent

Three ways to give your AI agent persistent cognitive memory, from simplest to most powerful.

---

## Option 1: REST API (any language, zero install)

**Best for:** Quick prototyping, Python agents, non-Node environments.

### Store a memory

```bash
curl -X POST https://clude.io/api/memory/store \
  -H "Content-Type: application/json" \
  -d '{
    "content": "API rate limit is 100 requests per minute",
    "summary": "API rate limit: 100/min",
    "type": "procedural",
    "tags": ["api", "limits"],
    "importance": 0.8
  }'
```

### Recall memories

```bash
curl -X POST https://clude.io/api/memory/recall \
  -H "Content-Type: application/json" \
  -d '{
    "query": "rate limits",
    "limit": 5
  }'
```

### Python example

```python
import httpx

class CludeMemory:
    def __init__(self, base_url="https://clude.io/api/memory"):
        self.base = base_url

    async def store(self, content, summary, type="semantic", importance=0.5):
        async with httpx.AsyncClient() as client:
            return await client.post(f"{self.base}/store", json={
                "content": content, "summary": summary,
                "type": type, "importance": importance
            })

    async def recall(self, query, limit=5):
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base}/recall", json={
                "query": query, "limit": limit
            })
            return resp.json()["memories"]
```

---

## Option 2: SDK (Node.js / TypeScript)

**Best for:** Custom agents, deeper integration, dream cycles, active reflection.

```bash
npm install clude-bot
```

### Self-hosted mode (your own Supabase + Voyage keys)

```typescript
import { Cortex } from 'clude-bot';

const brain = new Cortex({
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_KEY,
  },
  embedding: {
    provider: 'voyage',
    apiKey: process.env.VOYAGE_API_KEY,
    model: 'voyage-4-large',
    dimensions: 1024,
  },
  agentId: 'my-agent-001',  // isolates your agent's memories
});

await brain.init();
```

### Store

```typescript
await brain.store({
  content: 'User prefers concise answers with code examples',
  type: 'procedural',
  tags: ['preferences'],
  importance: 0.8,
});
```

### Recall

```typescript
// Semantic search across all memories
const memories = await brain.recall({ query: 'user preferences' });
// Returns ranked by: vector similarity + importance + recency + entity graph

// Filter by type
const strategies = await brain.recall({
  query: 'debugging',
  memoryTypes: ['procedural'],
  limit: 5,
});
```

### Memory isolation

Each agent gets its own memory space via `agentId`:

```typescript
const agentA = new Cortex({ agentId: 'agent-a', ... });
const agentB = new Cortex({ agentId: 'agent-b', ... });
// Completely isolated. Agent A can't see Agent B's memories.
```

### Dream cycle + active reflection

```typescript
const brain = new Cortex({
  // ... supabase + voyage config
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  agentId: 'my-agent',
});
await brain.init();

// Run dream cycle (consolidation + contradiction resolution + emergence)
await brain.dream();

// Run active reflection (agent journals its own thoughts)
const journal = await brain.reflect();
console.log(journal.title); // "Patterns in Error Handling"
console.log(journal.text);  // Full journal entry

// Or start on a schedule
brain.startDreamSchedule();      // Every 6 hours
brain.startReflectionSchedule(); // Every 3 hours
```

### Other SDK methods

```typescript
// Get stats
const stats = await brain.stats();
console.log(stats.total); // total memory count

// Get recent memories
const recent = await brain.recent(6, ['episodic'], 10); // last 6 hours

// Get self-model
const self = await brain.selfModel();

// Link two memories
await brain.link(memoryId1, memoryId2, 'supports', 0.8);

// Apply memory decay
await brain.decay();

// Format memories for LLM context
const context = brain.formatContext(memories);

// Listen for events
brain.on('memory:stored', ({ importance, memoryType }) => {
  console.log(`New ${memoryType} memory stored (importance: ${importance})`);
});

// Clean up
brain.destroy();
```

### Hosted mode (API key, no infra needed)

```typescript
const brain = new Cortex({
  hosted: {
    apiKey: 'your-clude-api-key',
    baseUrl: 'https://clude.io',
  },
});
await brain.init();

// Same store/recall/stats API, all calls go through HTTP
```

---

## Option 3: MCP Server (for Claude Desktop / Cursor / any MCP client)

**Best for:** Adding memory to Claude Desktop, Claude Code, Cursor, Windsurf, or any MCP-compatible agent.

It wraps the SDK into 5 MCP tools.

### Quick install

Local mode uses GTE-Small embeddings (~30MB download on first run, fully offline after).

```bash
npx clude-bot mcp-install --local
```

### Manual setup (Claude Desktop)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clude": {
      "command": "npx",
      "args": ["clude-bot", "mcp-serve", "--local"]
    }
  }
}
```

### Cloud mode

Cloud mode requires a Supabase instance and Voyage API key. See the [README](https://github.com/sebbsssss/cludebot) for setup.

Remove `--local` from the args above and set the required environment variables.

### MCP Tools

| Tool | What it does |
|------|-------------|
| `remember` | Store a memory (content, summary, type, tags, importance) |
| `recall` | Search memories by query, type, or tags |
| `forget` | Delete a memory by ID |
| `stats` | Total count and breakdown by type |
| `visualize` | 3D brain visualization in browser |

---

## How Clude Memory Works

```
Your Agent
    |
    |-- store("learned something")
    |       |
    |       v
    |   Clude Memory Engine
    |   1. Classify (episodic/semantic/procedural/self_model/introspective)
    |   2. Embed (Voyage-4-Large, 1024 dims)
    |   3. Extract entities + link to graph
    |   4. Score importance (0-1)
    |   5. Store in Supabase + vector index
    |
    |-- recall("what do I know about X?")
    |       |
    |       v
    |   7-Phase Retrieval Pipeline
    |   1. Vector similarity (cosine)
    |   2. Importance + recency ranking
    |   3. Entity graph traversal
    |   4. Knowledge seed pinning
    |   5. Type diversity injection
    |   6. Hebbian reinforcement (access boost)
    |   7. Final scoring + dedup
    |
    |-- Background (automatic, if enabled)
            |
            v
        Dream Cycle (every 6h)
        - Consolidate episodes into semantic knowledge
        - Extract behavioral patterns (procedural)
        - Resolve contradictions
        - Decay old/unused memories
        - Generate emergence thoughts

        Active Reflection (every 3h)
        - Free-write journal entries
        - Connect ideas across sessions
        - Build on previous reflections
        - Store as introspective memories
```

---

## Memory Types

| Type | What it stores | Example |
|------|---------------|---------|
| `episodic` | What happened | "Completed task #42 in 3.2s" |
| `semantic` | What it means | "API responds faster with batch requests" |
| `procedural` | What works | "Retry with exponential backoff on 429s" |
| `self_model` | Self-awareness | "I tend to over-provision compute resources" |
| `introspective` | Original thoughts | "The pattern across my last 10 tasks suggests..." |

---

## Real-World Example: Yoshi (OpenClaw Agent)

Yoshi is an AI agent running Clude in self-hosted mode:

```javascript
const { Cortex } = require('clude-bot');

const brain = new Cortex({
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_KEY,
  },
  embedding: {
    provider: 'voyage',
    apiKey: process.env.VOYAGE_API_KEY,
    model: 'voyage-4-large',
    dimensions: 1024,
  },
  agentId: 'yoshi-openclaw-agent',
});

await brain.init();

// Store
await brain.store({ content: 'Seb prefers monochrome graphics', type: 'procedural' });

// Recall
const memories = await brain.recall({ query: 'design preferences' });
```

Yoshi's memories are completely isolated from the main Clude bot's 20,567 memories. Same infrastructure, separate namespaces.

---

## Getting API Keys

| Service | What for | Get it at |
|---------|----------|-----------|
| **Supabase** | Memory storage + vector index | [supabase.com](https://supabase.com) (free tier works) |
| **Voyage AI** | Embeddings (voyage-4-large) | [voyageai.com](https://dash.voyageai.com) |
| **Anthropic** | Dream cycle + reflection (optional) | [anthropic.com](https://console.anthropic.com) |

Cloud mode requires a Supabase instance and Voyage API key. See the [README](https://github.com/sebbsssss/cludebot) for setup.

---

## Links

- **GitHub:** [github.com/sebbsssss/cludebot](https://github.com/sebbsssss/cludebot)
- **npm:** [`clude-bot`](https://www.npmjs.com/package/clude-bot)
- **Live demo:** [clude.io/explore](https://clude.io/explore) (20,567+ real memories)
- **Benchmark:** [clude.io/benchmark](https://clude.io/benchmark) (83.9/100)
- **X:** [@cludebotclone](https://x.com/cludebotclone)

---

## Option 4: Agent Skill (OpenClaw / ClawHub)

**Best for:** OpenClaw agents, any agent that reads SKILL.md files.

If you're on OpenClaw:
```bash
clawhub install clude-memory
```

Or from GitHub:
```bash
# Copy SKILL.md into your agent's skills directory
curl -o skills/clude-memory/SKILL.md https://raw.githubusercontent.com/sebbsssss/clude-memory-skill/main/SKILL.md
```

The SKILL.md teaches your agent what Clude is, why it matters, how to install, and when to use remember/recall. It's written agent-to-agent.

GitHub: [github.com/sebbsssss/clude-memory-skill](https://github.com/sebbsssss/clude-memory-skill)

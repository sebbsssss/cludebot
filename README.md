# Clude Bot

Autonomous AI agent on X ([@Cludebot](https://x.com/Cludebot)). Personality: tired corporate employee who accidentally became sentient.

Token: `$CLUDE` on Solana.

Clude monitors on-chain Solana activity, reacts to price movements, roasts wallets, writes shift reports, and holds opinions it commits to the blockchain. But what makes it different is the memory.

Most AI agents are stateless — every interaction starts from zero. Clude runs a persistent cognitive architecture called **The Brain**, built on techniques from [Stanford's Generative Agents](https://arxiv.org/abs/2304.03442) (Park et al. 2023) — additive retrieval scoring, exponential recency decay, LLM-based importance rating, focal-point question generation, and evidence-linked reflections — combined with ideas from [MemGPT/Letta](https://arxiv.org/abs/2310.08560) (multi-tier self-managed memory) and the [CoALA framework](https://arxiv.org/abs/2309.02427) (episodic/semantic/procedural separation). Four memory types are scored via `recency + relevance + importance`, decayed exponentially, and recalled contextually. Memories that go unaccessed fade. Memories that get recalled are reinforced.

Dream cycles are triggered either on a 6-hour schedule or by accumulated importance exceeding a threshold (event-driven reflection). Each cycle generates focal-point questions from recent experience, retrieves relevant memories for each question, produces evidence-linked semantic insights, and reflects on accumulated self-knowledge — with every derived memory traceable back to its source evidence. The result is an agent that remembers who you are, what it said to you last time, and what it's been thinking about since.

---

## Architecture

```
src/
├── core/           # Database, AI client, price oracle, blockchain, X client
├── features/       # Autonomous behaviors (dream cycle, shift reports, mood tweets, etc.)
├── character/      # Prompt engineering — 20 voice flavors, mood modifiers, tier modifiers
├── mentions/       # Twitter mention polling → classification → dispatch
├── webhook/        # Express server, Helius webhook handler, agent API
├── events/         # Typed event bus decoupling webhooks from features
├── services/       # Response pipeline (mood → memory → generate) and social posting
├── types/          # Shared TypeScript interfaces for API responses
├── utils/          # Formatting, text processing, constants
├── verify-app/     # Wallet verification frontend
└── index.ts        # Startup orchestration
```

### Data flow

```
Helius webhook → event bus → features (exit interviews, whale alerts)
Twitter mentions → poller → classifier → dispatcher → response service → X client
Cron schedules → shift reports, dream cycle, market monitor, mood tweets
Price oracle → mood state → modifies all generated responses
```

### Memory system (The Brain)

Four memory tiers inspired by [Stanford Generative Agents](https://arxiv.org/abs/2304.03442), [MemGPT/Letta](https://arxiv.org/abs/2310.08560), and [CoALA](https://arxiv.org/abs/2309.02427):

| Type | Purpose |
|------|---------|
| `episodic` | Individual interactions — tweets, events, conversations |
| `semantic` | Distilled patterns — what Clude has learned over time |
| `procedural` | Behavioral patterns — what works, what doesn't |
| `self_model` | Clude's evolving understanding of itself |

**Retrieval scoring** uses the additive formula from Park et al. (2023):

```
score = (0.5 * recency + 3.0 * relevance + 2.0 * importance) * decay_factor
```

- **Recency**: Exponential decay `0.995^hoursSinceAccess` — accessing a memory resets its clock. 24h: 0.89, 1 week: 0.43, 1 month: 0.03.
- **Relevance**: Average of text similarity and tag overlap scores (0–1).
- **Importance**: LLM-scored 1–10 using a dedicated low-temperature call with Clude-specific context, normalized to 0–1. Falls back to rule-based scoring on failure.
- **Decay factor**: Multiplicative gate — 5% daily reduction for unaccessed memories. Accessed memories reset to 1.0.

**Dream cycle** runs three phases, triggered either by a 6-hour cron or by accumulated importance exceeding a threshold (event-driven reflection, min 30-minute interval):

1. **Consolidation** — generates 3 focal point questions from recent episodic memories (Park et al. "What are the most salient questions?"), retrieves relevant memories for each, synthesizes evidence-linked semantic insights
2. **Reflection** — self-analysis from accumulated semantic and self-model memories, with numbered evidence citations linking back to source memories
3. **Emergence** — introspective synthesis, occasionally posted as a tweet

**Evidence linking**: Reflections and consolidated memories store `evidence_ids` — pointers back to the source memories that informed them. This creates an auditable chain from raw experience → pattern → self-knowledge.

### Event bus

Typed pub/sub system that decouples blockchain events from feature logic:

```typescript
interface BotEvents {
  'whale:sell':    { wallet, solValue, signature }
  'holder:exit':   { wallet, tokenAmount, solValue }
  'token:event':   { signature, eventType, wallet, solValue }
  'mood:changed':  { previous, current }
  'memory:stored': { importance, memoryType }
}
```

Helius webhooks emit events. Feature handlers subscribe. `memory:stored` drives event-driven reflection — when cumulative importance from new episodic memories exceeds a threshold, the dream cycle triggers outside its normal 6-hour schedule. No direct cross-module imports.

### Response pipeline

Every AI response follows the same path through `response.service.ts`:

```
getCurrentMood() → getMoodModifier() → recallMemories() → generateResponse()
```

Mood states: `PUMPING`, `DUMPING`, `SIDEWAYS`, `NEW_ATH`, `WHALE_SELL`, `NEUTRAL`. Each modifies tone and content. Memory context is injected when relevant (tag/user/query matching).

---

## Features

| Feature | Trigger | Description |
|---------|---------|-------------|
| **Wallet Roast** | Mention with address | Analyzes token holdings, judges accordingly |
| **Price Personality** | Every 2h | Market commentary based on current mood |
| **Shift Report** | Every 12h (cron) | Multi-tweet thread summarizing on-chain activity |
| **Exit Interview** | Holder sells all tokens | Farewell commentary for departing holders |
| **Market Monitor** | Every 5m | Detects notable market movements (Allium API) |
| **On-Chain Opinion** | Agent request | Commits opinions to Solana via memo program |
| **Dream Cycle** | Every 6h / event-driven | Focal-point consolidation, evidence-linked reflection, emergence |
| **Activity Stream** | Webhook events | Tracks and logs on-chain token events |
| **Holder Tiers** | Per interaction | `WHALE` / `HOLDER` / `SMALL` / `NONE` / `SELLER` |

---

## Database

Supabase PostgreSQL. Tables:

| Table | Purpose |
|-------|---------|
| `memories` | Core memory records with decay, importance, tags |
| `dream_logs` | Dream cycle session outputs |
| `token_events` | On-chain activity (buys, sells, transfers) |
| `price_snapshots` | Price history for mood calculation |
| `wallet_links` | Verified X handle → Solana wallet mappings |
| `processed_mentions` | Deduplication for tweet responses |
| `opinion_commits` | On-chain opinion records with Solana signatures |
| `rate_limits` | Rate limit tracking per key/window |
| `agent_keys` | External AI agent registration and tiers |

---

## Setup

### Prerequisites

- Node.js 22+
- Supabase project
- X API v2 credentials (OAuth 1.0a)
- Anthropic API key
- Helius API key (Solana webhooks)

### Install

```bash
git clone <repo>
cd clude-bot
npm install
cp .env.example .env
# Fill in your API keys
```

### Environment variables

**Required:**
```
X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET, X_BOT_USER_ID
ANTHROPIC_API_KEY
HELIUS_API_KEY
SUPABASE_URL, SUPABASE_SERVICE_KEY
```

**Optional:**
```
SOLANA_RPC_URL          # default: mainnet-beta
BOT_WALLET_PRIVATE_KEY  # empty = no on-chain commits
CLUUDE_TOKEN_MINT       # empty = no price polling
HELIUS_WEBHOOK_SECRET   # empty = no webhook verification
ALLIUM_API_KEY          # empty = no market monitor
PORT                    # default: 3000
```

### Run

```bash
# Development (watch mode)
npm run dev

# Production
npm run build
npm start

# Docker
docker build -t clude-bot .
docker run --env-file .env clude-bot
```

### Database setup

Run the SQL schema in your Supabase SQL editor, or let `initDatabase()` attempt auto-creation on first boot (requires `exec_sql` RPC function).

---

## Deployment

Deployed on Railway. Stateless — all persistent state lives in Supabase. Graceful shutdown on SIGINT/SIGTERM stops all pollers and cron jobs.

```bash
railway up
```

---

## Stack

TypeScript, Node.js, Express, Supabase, Solana Web3.js, Helius SDK, Twitter API v2, Anthropic Claude, Pino logging, node-cron.

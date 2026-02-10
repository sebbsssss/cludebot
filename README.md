# Clude Bot

Autonomous AI agent on X ([@CludeClaw](https://x.com/CludeClaw)). Monitors on-chain Solana activity, reacts to price movements, roasts wallets, writes shift reports, and consolidates memories through a dream cycle. Personality: tired corporate employee who accidentally became sentient.

Token: `$CLUDE` on Solana.

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

### Memory system (The Cortex)

Four memory tiers inspired by Stanford Generative Agents and CoALA:

| Type | Purpose |
|------|---------|
| `episodic` | Individual interactions — tweets, events, conversations |
| `semantic` | Distilled patterns — what Clude has learned over time |
| `procedural` | Behavioral patterns — what works, what doesn't |
| `self_model` | Clude's evolving understanding of itself |

Memories are scored by `relevance * importance * recency * decay_factor`. Unaccessed memories decay daily. Accessed memories get reinforced (decay resets to 1.0).

Every 6 hours, the **dream cycle** runs three phases:
1. **Consolidation** — episodic memories distilled into semantic patterns
2. **Reflection** — self-analysis from accumulated knowledge
3. **Emergence** — introspective synthesis, occasionally posted as a tweet

### Event bus

Typed pub/sub system that decouples blockchain events from feature logic:

```typescript
interface BotEvents {
  'whale:sell':   { wallet, solValue, signature }
  'holder:exit':  { wallet, tokenAmount, solValue }
  'token:event':  { signature, eventType, wallet, solValue }
  'mood:changed': { previous, current }
}
```

Helius webhooks emit events. Feature handlers subscribe. No direct cross-module imports.

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
| **Dream Cycle** | Every 6h (cron) | Memory consolidation, reflection, emergence |
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

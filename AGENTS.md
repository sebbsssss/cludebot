# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Clude Bot is a persistent memory SDK and autonomous AI agent for Solana. It is a single-service Node.js (>=22) + TypeScript application using npm as the package manager. There is no ESLint or test suite configured; the lint-equivalent check is `npm run typecheck`.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Typecheck (lint) | `npm run typecheck` |
| Build | `npm run build` |
| Dev server | `npm run dev` |
| SDK-only build | `npm run build:sdk` |
| MCP server | `npm run mcp` |

### Running locally without external APIs

Set `SITE_ONLY=true` in `.env` to run the Express server (port 3000) without needing Supabase, Anthropic, X/Twitter, or any other external credentials. This mode serves the static website, all `/api/*` endpoints, and the demo page. It is the recommended way to develop UI and API route changes.

For full bot mode, you need at minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, plus X/Twitter credentials. See `.env.example` for the complete list.

### Non-obvious caveats

- The project uses **CommonJS** (`"module": "commonjs"` in tsconfig), not ESM.
- Dev mode uses `tsx watch` which provides hot reloading. However, changes to `.env` require a restart.
- The `postinstall` script (`scripts/postinstall.js`) is cosmetic only (prints a banner); it does not perform any setup.
- There is no test suite. CONTRIBUTING.md acknowledges this. TypeScript typecheck (`npm run typecheck`) is the primary automated quality gate.
- Static files are served from `src/verify-app/public/` in dev mode and `dist/verify-app/public/` in production. Both paths are mounted by the Express server.

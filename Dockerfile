# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Backend dependencies (cached layer)
COPY package.json package-lock.json* ./
COPY scripts/ ./scripts/
RUN npm ci

# Frontend dependencies (cached layers — lockfile-only changes skip reinstall)
COPY chat/package.json chat/package-lock.json* ./chat/
RUN cd chat && npm ci

COPY dashboard/package.json dashboard/package-lock.json* ./dashboard/
RUN cd dashboard && npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY chat/ ./chat/
COPY dashboard/ ./dashboard/

# Build TypeScript backend
RUN npm run build

# Build frontends — Vite picks up VITE_* from process env (ARGs are env vars in RUN)
ARG VITE_PRIVY_APP_ID
ARG VITE_SOLANA_RPC_URL
ARG VITE_API_BASE

RUN cd chat && npx vite build
RUN cd dashboard && npx vite build

# Production stage
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts/ ./scripts/
RUN npm ci

# Compiled backend
COPY --from=builder /app/dist/ ./dist/

# Static assets (includes freshly built chat + dashboard from Vite)
COPY --from=builder /app/src/verify-app/public/ ./dist/verify-app/public/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]

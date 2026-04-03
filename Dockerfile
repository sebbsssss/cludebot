# Build stage
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

# Copy workspace config and all package.json files for install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/ ./packages/tsconfig/
COPY packages/core/package.json ./packages/core/
COPY apps/backend/package.json ./apps/backend/
COPY apps/chat/package.json ./apps/chat/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core/ ./packages/core/
COPY apps/backend/ ./apps/backend/
COPY apps/chat/ ./apps/chat/
COPY apps/dashboard/ ./apps/dashboard/
COPY apps/web/ ./apps/web/

# Build backend (order matters: core → backend)
RUN pnpm --filter @clude/core build
RUN pnpm --filter @clude/backend build

# Build frontends
ARG PRIVY_APP_ID
ENV VITE_PRIVY_APP_ID=$PRIVY_APP_ID

RUN pnpm --filter @clude/chat exec vite build
RUN pnpm --filter @clude/dashboard exec vite build

# Production stage
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/ ./packages/tsconfig/
COPY packages/core/package.json ./packages/core/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core/dist/ ./packages/core/dist/
COPY --from=builder /app/apps/backend/dist/ ./apps/backend/dist/
COPY --from=builder /app/apps/web/public/ ./apps/web/public/
COPY --from=builder /app/apps/chat/dist/ ./apps/chat/dist/
COPY --from=builder /app/apps/dashboard/dist/ ./apps/dashboard/dist/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/backend/dist/index.js"]

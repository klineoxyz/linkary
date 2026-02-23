# Linkary Worker - Railway deploy (monorepo root)
# Use with Root Directory = . (repo root). Cron services override start command per run.

FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace and app code for install + build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/

# Builder: use corepack for pnpm (no npm -g), install deps, build worker only
FROM base AS builder
RUN corepack enable \
    && corepack prepare pnpm@9.15.0 --activate \
    && pnpm install \
    && pnpm --filter worker run build

# Runtime: built worker + deps (pnpm workspace layout)
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/worker ./apps/worker
# Cron overrides start command per run (sync:x:profiles:daily, sync:x:tweets:weekly, run:jobs)
CMD ["node", "apps/worker/dist/run_analytics_jobs.js"]

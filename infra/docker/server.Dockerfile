# The server image: the API, the MCP server and the background jobs.
# Build from the repository root:  docker build -f infra/docker/server.Dockerfile -t study-manager-server .
# syntax=docker/dockerfile:1

FROM node:24.22.2-bookworm-slim AS base
# pg_dump 17 for the nightly backups; the PostgreSQL 17 client comes from the PostgreSQL apt repository.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@12.16.1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
# Only what the server runs on; the package store is not kept in the image.
RUN pnpm install --frozen-lockfile --prod --filter @study/server... --store-dir /tmp/pnpm-store \
 && rm -rf /tmp/pnpm-store

FROM base AS runtime
ENV NODE_ENV=production \
    MODELS_DIR=/data/models
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/server apps/server
COPY packages/shared packages/shared
COPY infra/scripts/setup.mjs infra/scripts/setup.mjs
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
WORKDIR /app/apps/server
CMD ["node", "--import", "tsx", "src/index.ts"]

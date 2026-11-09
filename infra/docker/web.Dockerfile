# The web image: Caddy with the built web app. It is the one address behind your reverse proxy:
# it serves the app and passes /api, /mcp, /ical and /auth to the server and the sign-in service.
# Build from the repository root:  docker build -f infra/docker/web.Dockerfile -t study-manager-web .
# syntax=docker/dockerfile:1

FROM node:26.12.1-bookworm-slim AS build
RUN npm install -g pnpm@12.16.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @study/web... --store-dir /tmp/pnpm-store \
 && rm -rf /tmp/pnpm-store
COPY apps/web apps/web
COPY packages packages
COPY infra/scripts/ui-gate.mjs infra/scripts/ui-gate.mjs
# The UI check, the type check and Vite.
RUN pnpm --filter @study/web build

FROM caddy:2.10.2
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
EXPOSE 80

# Build context: repository root (monorepo with the shared package)
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web... --filter @heyreply/shared

COPY packages/shared packages/shared
COPY apps/web apps/web

# Rewrites (/api/* → Nest) are resolved at build time, so the API address is a build arg
ARG API_URL=http://api:4000
ARG HTTPS_ENABLED=true
ENV API_URL=$API_URL HTTPS_ENABLED=$HTTPS_ENABLED NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @heyreply/shared build && pnpm --filter web build

# Next writes its runtime cache here; everything else stays root-owned and read-only for the app user
RUN chown -R node:node /repo/apps/web/.next
WORKDIR /repo/apps/web
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]

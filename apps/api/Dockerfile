# Build context: repository root (monorepo with the shared package)
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo

# Install dependencies first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter api... --filter @heyreply/shared

COPY packages/shared packages/shared
COPY apps/api apps/api

# prisma.config.ts reads DATABASE_URL even for `generate`; the real value comes from compose at runtime
RUN pnpm --filter @heyreply/shared build \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter api prisma:generate \
 && pnpm --filter api build

WORKDIR /repo/apps/api
ENV NODE_ENV=production
# Drop root: the app only needs to read its files
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

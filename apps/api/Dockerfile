FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @cards-hub/shared... --filter @cards-hub/api...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN cd packages/shared && pnpm build
RUN cd apps/api && pnpm exec prisma generate && pnpm build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

# Preserve pnpm workspace layout so @cards-hub/shared resolves correctly
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma/

# Install production dependencies only (creates proper node_modules layout)
RUN pnpm install --frozen-lockfile --prod --filter @cards-hub/api...

# Regenerate Prisma client (production node_modules is fresh after --prod install)
RUN cd apps/api && pnpm exec prisma generate

# Copy the entrypoint script (before switching to non-root user)
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create storage directories
RUN mkdir -p /app/storage/public /app/storage/paid /app/storage/exports \
    && chown -R appuser:appgroup /app/storage

USER appuser
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

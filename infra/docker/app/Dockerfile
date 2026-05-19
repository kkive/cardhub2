# ---- Builder stage ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /build

# Copy workspace manifests and lockfile for dependency resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install all dependencies (including devDependencies for build)
RUN pnpm config set package-import-method copy && pnpm install --frozen-lockfile

# Copy source files needed for the build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/

# Build order: shared -> prisma generate -> api + web
RUN pnpm run build:shared
RUN cd apps/api && pnpm exec prisma generate
RUN pnpm run build:api
RUN pnpm run build:web

# ---- Production dependencies stage ----
FROM node:22-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /build

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

COPY apps/api/prisma apps/api/prisma

RUN pnpm config set package-import-method copy && pnpm install --frozen-lockfile --prod --filter @cards-hub/api...

# Generate Prisma client here so runtime doesn't need network access
RUN cd apps/api && pnpm exec prisma generate

# ---- Runtime stage ----
FROM node:22-alpine

RUN apk add --no-cache nginx supervisor && \
    corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Copy production node_modules from prod-deps stage
COPY --from=prod-deps /build/node_modules ./node_modules
COPY --from=prod-deps /build/apps/api/node_modules ./apps/api/node_modules

# Copy built artifacts from builder
COPY --from=builder /build/apps/api/dist ./apps/api/dist
COPY --from=builder /build/apps/api/prisma ./apps/api/prisma
COPY --from=builder /build/packages/shared/dist ./packages/shared/dist
COPY --from=builder /build/apps/web/dist /usr/share/nginx/html

# Create storage directories
RUN mkdir -p /app/storage/public /app/storage/paid /app/storage/exports

# Copy nginx config
COPY infra/docker/app/nginx.conf /etc/nginx/nginx.conf

# Copy supervisord config
COPY infra/docker/app/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy and set up entrypoint
COPY infra/docker/app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000 8000

ENTRYPOINT ["/app/entrypoint.sh"]

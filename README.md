# Cards hub

A card management platform with AI-assisted workflows. Create, browse, share, and trade digital cards with SillyTavern/TavernAI compatibility.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for services)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env

# 3. Start infrastructure (MySQL, Redis, Meilisearch)
docker compose up -d mysql redis meilisearch

# 4. Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed database (admin, tags, example card)
pnpm db:seed

# 6. Start dev servers (API + Web)
pnpm dev
```

API runs at `http://localhost:3000/api`, Web at `http://localhost:8000`.

## Run Modes

### Mode A - Full Docker

```bash
docker compose up -d       # or: pnpm docker:up
```

Starts all services: mysql, redis, meilisearch, api, worker, web, nginx. Open `http://localhost` (via local nginx) or `http://localhost:8000` (direct to web).

### Mode B - Local Development

```bash
docker compose up -d mysql redis meilisearch   # or: pnpm start:infra
pnpm dev
```

Only infrastructure runs in Docker; API and Web run on the host with hot-reload. **Do not run the full Docker stack at the same time** - ports 3000 (api) and 8000 (web) will conflict.

### Mode C - Production (Docker Hub)

Deploy a single pre-built image on a server without building from source. The image (e.g. `kanggejie/cards-hub:v1`) contains the API, BullMQ worker, and web static files in one container. MySQL, Redis, and Meilisearch run as official images via `docker-compose.prod.yml`.

**Prerequisites:** `docker login -u kanggejie` (or your Docker Hub username). The scripts use `docker buildx build --push` so the image goes directly to Docker Hub without a separate `docker push` step.

**Build & push (local or CI):**

```bash
# PowerShell
.\scripts\docker-build-push.ps1 your-dockerhub-username [tag] [platform]

# Bash
./scripts/docker-build-push.sh your-dockerhub-username [tag] [platform]
```

This builds and pushes one image: `<namespace>/cards-hub:<tag>` (Docker Hub repo: `cards-hub`) from `infra/docker/app/Dockerfile`. Default platform is `linux/amd64`; pass `linux/arm64` or `linux/amd64,linux/arm64` for other targets. Docker Hub no longer needs separate `cards-hub-api`, `cards-hub-worker`, or `cards-hub-web` repositories.

**Deploy on server:**

```bash
# 1. Copy prod compose and env to the server
scp docker-compose.prod.yml .env.production.example user@server:~/cards-hub/

# 2. On the server: create .env from the example and fill in real values
cd ~/cards-hub
cp .env.production.example .env
nano .env   # fill in secrets

# 3. Pull images and start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 4. Health check
curl -f http://127.0.0.1:3000/api/health
```

The prod compose file uses pre-built images (no `build` sections). The app container binds API to `127.0.0.1:3000` and web to `127.0.0.1:8000` by default for the server's own nginx. MySQL, Redis, and Meilisearch are internal to the Docker network. Server nginx hint: `/api/` -> `http://127.0.0.1:3000/api/` and `/` -> `http://127.0.0.1:8000`. After configuring the server's own nginx, the public health check is `https://your-domain/api/health`.

**First admin:** On first startup, if no admin exists in the database, the API auto-creates one using `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`. Once an admin exists, these env vars are ignored (password is never reset). Alternatively, open `/admin` in the browser to manually create the first admin with email + password — then log in at `/login`.

## Container Roles

| Service | Role |
|---------|------|
| `mysql` | Primary database (MySQL 8.4) |
| `redis` | Cache + BullMQ queue backend |
| `meilisearch` | Full-text search engine |
| `app` | Single container: NestJS API (port 3000) + BullMQ worker + Umi web static files (port 8000). Used in production (`docker-compose.prod.yml`). |

In local full Docker mode (`docker-compose.yml`), `api`, `worker`, and `web` run as separate containers with a local nginx reverse proxy.

## Project Structure

```
apps/api/       - NestJS backend (REST API) + BullMQ worker (exports, cleanup, stats, search-sync)
apps/web/       - Umi Max / Ant Design Pro frontend
packages/shared/ - Shared TypeScript types
infra/docker/   - Docker & nginx configuration
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (DB, Redis, Meilisearch, storage) |
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/login` | POST | Login with credentials, returns JWT |
| `/api/auth/me` | GET | Get current authenticated user |
| `/api/cards` | GET/POST | List published cards or create (admin, default draft) |
| `/api/cards/search` | GET | Search published cards (Meilisearch or DB fallback) |
| `/api/cards/admin/list` | GET | Admin card list with filters (q, status, cardType, page, limit) |
| `/api/cards/:id` | GET/PUT/DELETE | Get published card, update, or delete (admin) |
| `/api/cards/:id/publish` | POST | Publish a draft card (admin) |
| `/api/cards/:id/unpublish` | POST | Unpublish a card back to draft (admin) |
| `/api/tags` | GET/POST | List or create tags |
| `/api/files/upload` | POST | Upload a file to a card |
| `/api/files/:id/download` | GET | Download a file (entitlement check for paid) |
| `/api/files/:cardId/export` | POST | Export card as JSON (entitlement check for paid) |
| `/api/files/exports/:id/download` | GET | Download card export file |
| `/api/admin/bootstrap-status` | GET | Check if admin exists |
| `/api/admin/bootstrap` | POST | Bootstrap first admin |
| `/api/passkey/register/challenge` | POST | Start passkey registration |
| `/api/passkey/register/verify` | POST | Verify passkey registration |
| `/api/passkey/login/challenge` | POST | Start passkey login |
| `/api/passkey/login/verify` | POST | Verify passkey login |
| `/api/orders` | POST/GET | Create order (targetType: card or collection) or list user orders |
| `/api/orders/admin/list` | GET | Admin order list with filters (userId, status, targetType, page, limit) |
| `/api/orders/:id` | GET | Get order details |
| `/api/collections` | GET | List published collections (q, priceMin, priceMax, sort, page, limit) |
| `/api/collections` | POST | Create draft collection (admin, validates 3 card types) |
| `/api/collections/admin/list` | GET | Admin collection list with filters (q, status, page, limit) |
| `/api/collections/:id` | GET | Get published collection detail (admin sees drafts) |
| `/api/collections/:id` | PUT | Update collection (admin) |
| `/api/collections/:id` | DELETE | Delete collection (admin) |
| `/api/collections/:id/publish` | POST | Publish collection (admin) |
| `/api/collections/:id/unpublish` | POST | Unpublish collection (admin) |
| `/api/collections/:id/export` | POST | Export collection as ZIP (entitlement check for paid) |
| `/api/collections/exports/:exportId/download` | GET | Download collection export ZIP (entitlement check for paid) |
| `/api/audit/logs` | GET | List audit logs |
| `/api/audit/config` | GET/PUT | Get or update audit config |
| `/api/users` | GET | List users (admin) |
| `/api/users/:id` | PATCH/DELETE | Update role or delete user (admin) |
| `/api/config` | GET/PUT | Get or update system config |
| `/api/payments/stripe/webhook` | POST | Stripe webhook handler |
| `/api/payments/yipay/webhook` | POST | YiPay webhook handler |
| `/api/payments/epay/create` | POST | Create epay payment order |
| `/api/payments/epay/notify` | POST | Epay webhook handler |

## Web Routes

| Route | Description |
|-------|-------------|
| `/cards` | Mobile-friendly card marketplace - search, filter drawer, sort, grid/table view, detail drawer, paid order creation |
| `/collections` | Public collection market - search, detail view, whole ZIP export, paid order creation |
| `/admin` | Mobile admin console - overview, card management, collection management, order lookup, config, audit |
| `/login` | Mobile-safe login page (JWT + passkey) |
| `/register` | Mobile-safe registration page |

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run API + Web in parallel (dev mode) |
| `pnpm dev:api` | Run API only (watch mode) |
| `pnpm dev:web` | Run web only (dev mode) |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check web app (tsc --noEmit) |
| `pnpm typecheck:web` | Type-check web app only |
| `pnpm start:api` | Start API (production) |
| `pnpm start:worker` | Start BullMQ worker |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations (dev) |
| `pnpm db:migrate:deploy` | Deploy database migrations (prod) |
| `pnpm db:seed` | Seed database |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Test all packages |
| `pnpm start:infra` | Start infra containers only (mysql, redis, meilisearch) |
| `pnpm docker:up` | Start all Docker services |
| `pnpm docker:down` | Stop all Docker services |

## Environment

See `.env.example` for all required environment variables. Key settings:

- `DATABASE_URL` - MySQL connection string (host-local dev, uses `localhost`)
- `REDIS_URL` - Redis connection (host-local dev, uses `localhost`)
- `MEILI_HOST` / `MEILI_API_KEY` - Meilisearch (host-local dev)
- `DOCKER_DATABASE_URL` - Override MySQL URL for Docker containers (default: `mysql://cards:cards@mysql:3306/cards_hub`)
- `DOCKER_REDIS_URL` - Override Redis URL for Docker containers (default: `redis://redis:6379`)
- `DOCKER_MEILI_HOST` - Override Meilisearch URL for Docker containers (default: `http://meilisearch:7700`)
- `PASSKEY_RP_ID` / `PASSKEY_ORIGIN` - WebAuthn config
- `ADMIN_EMAIL` - Admin user email for seeding
- `ADMIN_PASSWORD` - First admin password (production only). Auto-creates an admin on startup if no admin exists yet. Ignored once an admin is present. You can also create the first admin via `/admin` in the browser.
- `STORAGE_DIR` - File storage path (host-local dev, e.g. `./storage`)
- `DOCKER_STORAGE_DIR` - File storage path inside Docker containers (default: `/app/storage`)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `YIPAY_SECRET` - YiPay signature secret

> **Host-local vs Docker:** When you run `pnpm dev` directly, the app reads `DATABASE_URL`/`REDIS_URL`/`MEILI_HOST` (pointing at `localhost`). When you run `docker compose up`, containers use `DOCKER_DATABASE_URL`/`DOCKER_REDIS_URL`/`DOCKER_MEILI_HOST` instead - which default to Docker-network service names. Similarly, `STORAGE_DIR` (host-local, e.g. `./storage`) is only used by `pnpm dev`; containers use `DOCKER_STORAGE_DIR` (default `/app/storage`) via the Docker volume. Your `.env` host-local values are never injected into containers.

### Dev Headers

For local development, pass `X-Dev-User-Id` header when accessing paid content to identify the user for entitlement checks. JWT is preferred; `X-Dev-User-Id` is a local dev convenience. Free content does not require authentication.

```
GET /api/files/:id/download
Authorization: Bearer <jwt>
# or for local dev:
X-Dev-User-Id: <user-id>
```

## Content Status

Cards and collections have a `status` field (`draft` / `published`):
- New cards and collections are created as `draft` by default.
- Only `published` items appear in public listings and search.
- Admin can publish/unpublish via `POST /api/cards/:id/publish` and `POST /api/collections/:id/publish`.

## Orders & Entitlements

Orders support two target types:
- **Card orders** (`targetType: 'card'`): Buy a single card. Creates a card entitlement.
- **Collection orders** (`targetType: 'collection'`): Buy a collection bundle. Creates a collection entitlement (does NOT grant individual card entitlements).

Legacy `{ cardId }` requests are still supported and treated as `targetType: 'card'`.

## Export Formats

Cards and collections can be exported in three formats:

- **Platform JSON** (`platform_json`) - Cards hub native format
- **SillyTavern V2** (`sillytavern_v2`) - `chara_card_v2` spec for SillyTavern 1.12+
- **TavernAI** (`tavernai`) - Legacy TavernAI character card format

Collection exports are ZIP archives containing `manifest.json`, `character.json`, `worldbook.json`, and `preset.json`.

## Mobile Admin Workflow

The admin console at `/admin` is optimized for mobile. A typical task flow:

1. **Create a card draft** - Fill in name, card type, description, tags, and upload files.
2. **Publish the card** - Once the card is ready, publish it so it appears in the public `/cards` marketplace.
3. **Create a collection draft** - Select exactly 3 cards (one character, one worldbook, one preset) and set a price.
4. **Publish the collection** - Publish to make it available in the `/collections` market with ZIP export support.

All steps work on mobile viewports (390x844, 430x932) with no horizontal overflow.

## Verification

Run these commands to verify the project is healthy:

```bash
pnpm db:generate           # Generate Prisma client
pnpm typecheck             # Type-check web app
pnpm build                 # Build all packages
pnpm test                  # Run tests
pnpm lint                  # Lint all packages
docker compose config --quiet  # Validate compose file
```

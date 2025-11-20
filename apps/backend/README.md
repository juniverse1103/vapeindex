# VapeIndex Backend

Cloudflare Workers + D1 Database backend for VapeIndex.

## Quick Start

For local development:
```bash
npm install
npm run dev              # Start local server
npm run db:migrate       # Apply migrations (first time only)
npm run db:seed          # Seed with sample data (first time only)
```

For deployment, see [Deployment Scripts](#deployment-scripts) below.

## Environments

### 1. Local Development (Fastest)
Uses in-memory SQLite database via Miniflare. Perfect for development.

```bash
# Start local dev server with local database
npm run dev

# API runs on: http://localhost:51728
# Database: Ephemeral (resets on restart)
```

### 2. Remote Development (Testing)
Uses remote D1 database on Cloudflare. Good for testing before production.

```bash
# Create dev database (one-time setup)
npx wrangler d1 create vapeindex-db-dev

# Update wrangler.toml with the database ID from above
# Then run migrations
npx wrangler d1 migrations apply vapeindex-db-dev --env dev

# Seed the database
npx wrangler d1 execute vapeindex-db-dev --env dev --file=./seed.sql

# Deploy to dev environment
npx wrangler deploy --env dev

# API runs on: https://vapeindex-backend-dev.YOUR-SUBDOMAIN.workers.dev
```

### 3. Production
Uses production D1 database on Cloudflare.

```bash
# Create production database (one-time setup)
npx wrangler d1 create vapeindex-db-prod

# Update wrangler.toml with the database ID
# Run migrations
npx wrangler d1 migrations apply vapeindex-db-prod --env production

# Seed the database
npx wrangler d1 execute vapeindex-db-prod --env production --file=./seed.sql

# Deploy to production
npx wrangler deploy --env production

# API runs on: https://vapeindex-backend-prod.YOUR-SUBDOMAIN.workers.dev
```

## Database Commands

```bash
# Local development
npm run dev                           # Start dev server with local DB
npm run db:migrate                    # Apply migrations locally
npm run db:seed                       # Seed local database

# Remote development
npx wrangler d1 migrations list vapeindex-db-dev --env dev
npx wrangler d1 migrations apply vapeindex-db-dev --env dev
npx wrangler d1 execute vapeindex-db-dev --env dev --command "SELECT * FROM posts"

# Production
npx wrangler d1 migrations list vapeindex-db-prod --env production
npx wrangler d1 migrations apply vapeindex-db-prod --env production
npx wrangler d1 execute vapeindex-db-prod --env production --command "SELECT * FROM posts"
```

## Deployment Scripts

We provide helper scripts to streamline deployment:

### Deploy to Development
```bash
./scripts/deploy-dev.sh
```
This script will:
- Check if dev database is configured
- Show migration status
- Prompt to apply migrations
- Prompt to seed database
- Deploy to Cloudflare Workers dev environment

### Deploy to Production
```bash
./scripts/deploy-prod.sh
```
This script will:
- Require explicit confirmation
- Check if production database is configured
- Show migration status
- Prompt to apply migrations
- Prompt to seed database
- Deploy to Cloudflare Workers production environment

### Verify Deployment
```bash
# Test local deployment
./scripts/verify-deployment.sh http://localhost:51728

# Test remote deployment
./scripts/verify-deployment.sh https://vapeindex-backend-dev.YOUR-SUBDOMAIN.workers.dev
```
This script tests all API endpoints and reports their status.

## API Endpoints

- `GET /api/posts?sort=hot|new|top|rising&limit=20&offset=0`
- `GET /api/posts/:id`
- `GET /api/boards`
- `GET /api/stats`

## Environment Variables (Frontend)

Update these in your frontend:

**Development:** `.env.development`
```
PUBLIC_API_URL=http://localhost:51728
```

**Production:** `.env.production`
```
PUBLIC_API_URL=https://vapeindex-backend-prod.YOUR-SUBDOMAIN.workers.dev
```

## Deployment Checklist

- [ ] Create dev D1 database
- [ ] Update dev database ID in wrangler.toml
- [ ] Run migrations on dev database
- [ ] Seed dev database
- [ ] Deploy to dev environment
- [ ] Test dev endpoints
- [ ] Create production D1 database
- [ ] Update production database ID in wrangler.toml
- [ ] Run migrations on production database
- [ ] Seed production database (with real data, not test data)
- [ ] Deploy to production
- [ ] Update frontend `.env.production` with production API URL
- [ ] Test production endpoints

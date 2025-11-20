#!/bin/bash
set -e

echo "🚀 Deploying to Production Environment"
echo "========================================"
echo ""
echo "⚠️  WARNING: You are about to deploy to PRODUCTION"
echo ""
read -p "Are you sure you want to continue? (yes/no) " -r
echo ""
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# Check if production database ID is set
if grep -q 'database_id = ""' wrangler.toml | grep -A2 "\[env.production\]"; then
  echo "❌ Error: Production database ID not set in wrangler.toml"
  echo ""
  echo "Please run the following commands first:"
  echo "  1. npx wrangler d1 create vapeindex-db-prod"
  echo "  2. Update wrangler.toml [env.production.d1_databases].database_id with the ID from step 1"
  echo ""
  exit 1
fi

echo "📋 Checking migrations status..."
npx wrangler d1 migrations list vapeindex-db-prod --env production

echo ""
read -p "Apply migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗄️  Applying migrations..."
  npx wrangler d1 migrations apply vapeindex-db-prod --env production
fi

echo ""
echo "⚠️  NOTE: For production, you should seed with real data, not test data"
read -p "Seed database? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🌱 Seeding database..."
  npx wrangler d1 execute vapeindex-db-prod --env production --file=./seed.sql
fi

echo ""
echo "📦 Deploying to Cloudflare Workers..."
npx wrangler deploy --env production

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "Your API is available at:"
echo "https://vapeindex-backend-prod.YOUR-SUBDOMAIN.workers.dev"
echo ""
echo "🔴 IMPORTANT: Update your frontend .env.production file with the production URL!"

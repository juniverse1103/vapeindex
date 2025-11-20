#!/bin/bash
set -e

echo "🚀 Deploying to Development Environment"
echo "========================================"
echo ""

# Check if dev database ID is set
if grep -q 'database_id = ""' wrangler.toml; then
  echo "❌ Error: Dev database ID not set in wrangler.toml"
  echo ""
  echo "Please run the following commands first:"
  echo "  1. npx wrangler d1 create vapeindex-db-dev"
  echo "  2. Update wrangler.toml [env.dev.d1_databases].database_id with the ID from step 1"
  echo ""
  exit 1
fi

echo "📋 Checking migrations status..."
npx wrangler d1 migrations list vapeindex-db-dev --env dev

echo ""
read -p "Apply migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗄️  Applying migrations..."
  npx wrangler d1 migrations apply vapeindex-db-dev --env dev
fi

echo ""
read -p "Seed database with sample data? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🌱 Seeding database..."
  npx wrangler d1 execute vapeindex-db-dev --env dev --file=./seed.sql
fi

echo ""
echo "📦 Deploying to Cloudflare Workers..."
npx wrangler deploy --env dev

echo ""
echo "✅ Development deployment complete!"
echo ""
echo "Your API is available at:"
echo "https://vapeindex-backend-dev.YOUR-SUBDOMAIN.workers.dev"
echo ""
echo "Don't forget to update your frontend .env.development file!"

#!/bin/bash
# Setup local test environment

echo "🔧 Setting up local test environment..."
echo ""

# Apply migrations to local DB
echo "📊 Applying database migrations..."
wrangler d1 migrations apply vapeindex-db --local

# Create test user
echo ""
echo "👤 Creating test user..."
wrangler d1 execute vapeindex-db --local --command "INSERT OR REPLACE INTO users (id, username, display_name, email, karma, joined_at, last_seen, referral_code) VALUES ('test_user_123', 'testuser', 'Test User', 'test@vapeindex.io', 0, $(date +%s), $(date +%s), 'TEST123');"

echo ""
echo "✅ Local test environment ready!"
echo ""
echo "Test subscription with:"
echo "curl -X POST http://localhost:8787/api/subscriptions/subscribe \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"userId\":\"test_user_123\",\"planKey\":\"premium\"}'"

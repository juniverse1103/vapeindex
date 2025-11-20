#!/bin/bash

# Verify deployment by testing all API endpoints
# Usage: ./scripts/verify-deployment.sh <API_URL>
#   Example: ./scripts/verify-deployment.sh http://localhost:51728
#   Example: ./scripts/verify-deployment.sh https://vapeindex-backend-dev.your-subdomain.workers.dev

if [ -z "$1" ]; then
  echo "Usage: $0 <API_URL>"
  echo "  Example: $0 http://localhost:51728"
  echo "  Example: $0 https://vapeindex-backend-dev.your-subdomain.workers.dev"
  exit 1
fi

API_URL=$1

echo "🔍 Verifying deployment at: $API_URL"
echo "========================================"
echo ""

# Test /api/stats
echo "Testing GET /api/stats..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/stats")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ /api/stats - OK"
  echo "   Stats: $BODY"
else
  echo "❌ /api/stats - Failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

# Test /api/boards
echo "Testing GET /api/boards..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/boards")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ /api/boards - OK"
  BOARD_COUNT=$(echo "$BODY" | jq '. | length' 2>/dev/null || echo "N/A")
  echo "   Boards count: $BOARD_COUNT"
else
  echo "❌ /api/boards - Failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

# Test /api/posts with different sorts
for SORT in hot new top rising; do
  echo "Testing GET /api/posts?sort=$SORT&limit=5..."
  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/posts?sort=$SORT&limit=5")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ /api/posts?sort=$SORT - OK"
    POST_COUNT=$(echo "$BODY" | jq '. | length' 2>/dev/null || echo "N/A")
    echo "   Posts count: $POST_COUNT"
  else
    echo "❌ /api/posts?sort=$SORT - Failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
  fi
  echo ""
done

echo "========================================"
echo "Verification complete!"

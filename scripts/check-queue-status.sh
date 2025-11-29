#!/bin/bash
# Script to check embedding queue status
# Usage: ./scripts/check-queue-status.sh [PORT] [JWT_TOKEN]

PORT=${1:-5000}
TOKEN=${2:-""}

if [ -z "$TOKEN" ]; then
  echo "⚠️  No JWT token provided. The endpoint requires authentication."
  echo ""
  echo "Usage:"
  echo "  ./scripts/check-queue-status.sh [PORT] [JWT_TOKEN]"
  echo ""
  echo "Example:"
  echo "  ./scripts/check-queue-status.sh 5000 'your-jwt-token-here'"
  echo ""
  echo "To get a JWT token, log in via the frontend or API and copy the token from:"
  echo "  - Browser DevTools > Application > Cookies > jwt_token"
  echo "  - Or from the login response"
  exit 1
fi

echo "📊 Checking embedding queue status..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:${PORT}/api/recommendations/embedding-queue/status")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Error: HTTP $HTTP_CODE"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
fi




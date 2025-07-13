#!/bin/bash

# Test script to demonstrate get-access-token.js usage patterns

echo "🧪 Testing get-access-token.js usage patterns"
echo "============================================="

# Set environment for testing (defaults to hello.coop if not set)
export HELLO_DOMAIN=${HELLO_DOMAIN:-hello.coop}

echo ""
echo "1. 📄 Getting token and saving to file..."
npm run get-token 2>/dev/null > token.json
echo "✅ Token saved to token.json"

echo ""
echo "2. 🔍 Extracting just the access token..."
ACCESS_TOKEN=$(cat token.json | jq -r '.access_token')
echo "✅ Access token extracted: ${ACCESS_TOKEN:0:50}..."

echo ""
echo "3. 📊 Showing token info..."
echo "Token type: $(cat token.json | jq -r '.token_type')"
echo "Expires in: $(cat token.json | jq -r '.expires_in') seconds"

echo ""
echo "4. 🌐 Testing token with direct API call..."
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     https://admin.${HELLO_DOMAIN}/api/v1/profile | jq -r '.profile.email'

echo ""
echo "5. 🔧 Testing token with MCP server..."
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "hello_get_profile",
      "arguments": {}
    }
  }' | jq -r '.result.content[0].text' | jq -r '.profile.name'

echo ""
echo "6. 🧹 Cleaning up..."
rm -f token.json
echo "✅ Test completed!"

echo ""
echo "💡 Usage examples:"
echo "  # Get fresh token inline (production)"
echo "  TOKEN=\$(npm run get-token 2>/dev/null | jq -r '.access_token')"
echo ""
echo "  # Get fresh token inline (testing)"
echo "  TOKEN=\$(npm run get-token 2>/dev/null | jq -r '.access_token')"
echo ""
echo "  # Use with curl"
echo "  curl -H \"Authorization: Bearer \$TOKEN\" https://admin.hello.coop/api/v1/profile"
echo ""
echo "  # Use with MCP server"
echo "  curl -X POST http://localhost:3000/mcp -H \"Authorization: Bearer \$TOKEN\" -d '{...}'" 
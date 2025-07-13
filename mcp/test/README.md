# MCP Test Suite

This directory contains comprehensive tests for the Hellō MCP server.

## Automated Tests

Run all automated tests with:
```bash
npm test
```

### Test Coverage

The automated test suite includes:

1. **stdio MCP Protocol Tests**
   - Server startup and initialization
   - MCP protocol compliance (JSON-RPC 2.0)
   - Tool discovery and listing
   - Basic functionality validation

2. **HTTP Server and CORS Tests**
   - HTTP server startup and health checks
   - CORS preflight handling (OPTIONS requests)
   - CORS header validation
   - Dynamic origin handling
   - MCP protocol over HTTP
   - OAuth well-known endpoints

3. **Version Tool Tests**
   - Non-authenticated tool calls
   - Admin API version information
   - Response format validation

## Manual Tests

Tests that require manual interaction are kept separate:

### OAuth Flow Test
```bash
npm run test:oauth
```

This test requires manual OAuth flow completion:
- Opens browser for authentication
- Requires user to complete login
- Tests authenticated tool calls
- Uses `hello.coop` domain (or `HELLO_DOMAIN` if set)

## Individual Test Files

You can also run individual test components:

```bash
# Run original CLI tests
npm run test:cli

# Run version tool tests
npm run test:version

# Run OAuth flow tests (manual)
npm run test:oauth
```

## Test Structure

- `test-runner.js` - Main automated test suite
- `cli.test.js` - Original CLI tests (legacy)
- `version.test.js` - Version tool tests (legacy)
- `oauth-manual.test.js` - OAuth flow tests (requires manual interaction)

## Environment Variables

- `HELLO_DOMAIN` - Override default domain (defaults to `hello.coop`)
- `PORT` - HTTP server port for testing (defaults to 3001 in tests)

## Expected Results

All automated tests should pass without user interaction. The test suite validates:

✅ MCP protocol compliance  
✅ Tool discovery and metadata  
✅ HTTP server functionality  
✅ CORS header implementation  
✅ OAuth endpoint availability  
✅ Non-authenticated tool execution  

Manual OAuth tests require browser interaction and valid credentials.

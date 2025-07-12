# @hellocoop/mcp

Model Context Protocol (MCP) CLI and server for the Hellō platform.

## Features
- CLI tool: `npx @hellocoop/mcp`
- Stdio transport for agent/CLI use
- OAuth login via browser (using Wallet MCP client app)
- Calls Hellō Admin REST API (OpenAPI-based)
- Environment variable overrides for domain and admin server
- Smart error handling for access tokens
- (Planned) StreamableHTTP server mode for AWS deployment

## Usage

```sh
npx @hellocoop/mcp [options]
```

## Environment Variables
- `HELLO_DOMAIN`: Override the default domain (e.g., `hello.coop`, `hello-dev.net`, `hello-beta.net`)
- `HELLO_ADMIN`: Override the admin server URL (e.g., `https://admin.hello-dev.net`)

## Development
- MCP logic is being refactored to use REST API calls (see `/documentation/json` on your admin server for OpenAPI spec)
- Uses `@hellocoop/helper-server` for OAuth flows

## Roadmap
- [x] CLI and stdio transport
- [ ] REST API integration (OpenAPI-based)
- [ ] StreamableHTTP server mode
- [ ] Test scripts

---
Maintained by Hello Identity Co-op 
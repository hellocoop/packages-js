# @hellocoop/mcp

Model Context Protocol (MCP) server for creating and managing [Hellō](https://hello.dev) applications.

## Quick Install

Click to install in VS Code:

**Stdio Transport (Local):**
<br>
<a href="vscode:mcp/install?%7B%22hello-admin-stdio%22%3A%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40hellocoop%2Fmcp%22%5D%7D%7D">
  <img src="https://img.shields.io/badge/Install%20Stdio-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install MCP using stdio in VS Code">
</a>

**streamableHTTP Transport (Remote):**
<br>
<a href="vscode:mcp/install?%7B%22hello-admin-http%22%3A%7B%22url%22%3A%22https%3A%2F%2Fmcp.hello.coop%2F%22%2C%22type%22%3A%22http%22%7D%7D">
  <img src="https://img.shields.io/badge/Install%20HTTP-VS%20Code-green?style=for-the-badge&logo=visualstudiocode" alt="Install MCP using streamableHTTP in VS Code">
</a>

## Usage

This MCP server lets you create and manage your Hellō applications directly from your AI assistant instead of using the [Hellō Console](https://console.hello.coop). It provides programmatic access to the Hellō Admin API for application management tasks.

**Note:** This server can only perform creation and management operations. If you want to delete your applications, you'll need to visit the [Hellō Console](https://console.hello.coop).

### Why Use This?

- **Streamlined Workflow**: Create and configure Hellō applications directly from your AI assistant
- **Automation**: Integrate application creation into your development workflow
- **Consistency**: Use the same interface across different development environments
- **Convenience**: No need to switch between your assistant and the web console for basic operations

### MCP Client Configuration

The MCP server is available using both stdio and HTTP transports:

#### Stdio Transport (Local)
The stdio transport runs a local server and performs an OAuth flow to get an access token valid for one hour to call the Admin APIs.

```json
{
  "hello-admin-stdio": {
    "command": "npx",
    "args": ["@hellocoop/mcp"]
  }
}
```

#### HTTP Transport (Remote)
The HTTP transport provides the latest OAuth authorization endpoints and doesn't run any code locally.

```json
{
  "hello-admin-http": {
    "url": "https://mcp.hello.coop/",
    "type": "http"
  }
}
```

## Features

- **Application Management**: Create, read, and update Hellō applications
- **Publisher Management**: Create and manage publishers (teams/organizations)
- **OAuth Integration**: Secure authentication via browser-based OAuth flow
- **Legal Document Generation**: Create Terms of Service and Privacy Policy templates
- **Logo Management**: Upload and manage application logos
- **Multiple Transports**: Both stdio and HTTP MCP transports supported
- **Environment Flexibility**: Configurable domains and admin servers

## Available Tools

- `hello_get_profile` - Get your developer profile and publishers
- `hello_create_publisher` - Create a new publisher (team/organization)
- `hello_read_publisher` - Read detailed publisher information
- `hello_create_application` - Create a new Hellō application
- `hello_read_application` - Read detailed application information
- `hello_update_application` - Update application settings
- `hello_upload_logo` - Upload application logos
- `hello_generate_login_button` - Generate HTML/JavaScript login buttons
- `hello_generate_legal_docs` - Generate Terms of Service and Privacy Policy templates
- `hello_logo_guidance` - Get guidance for creating theme-appropriate logos

## Environment Variables

- `HELLO_DOMAIN`: Override the default domain (defaults to `hello.coop`)
- `HELLO_ADMIN`: Override the admin server URL (defaults to `https://admin.hello.coop`)

## Development

### Local Development

For local development and testing:

```sh
# Clone the repository
git clone https://github.com/hellocoop/packages-js
cd packages-js/mcp

# Install dependencies
npm install

# Run in stdio mode
npm start

# Run HTTP server mode
npm run start:http
```

### Getting Access Tokens for Testing

The `get-token` script performs OAuth flow and outputs token data as JSON:

```sh
# Get complete token response
npm run get-token

# Extract just the access token
npm run get-token | jq -r '.access_token'

# Use in shell commands
TOKEN=$(npm run get-token 2>/dev/null | jq -r '.access_token')
curl -H "Authorization: Bearer $TOKEN" https://admin.hello.coop/api/v1/profile

# Save to file for reuse
npm run get-token > token.json
```

### Testing

Run the comprehensive test suite:

```sh
# Run all automated tests
npm test

# Run interactive OAuth test
npm run test:oauth-interactive
```

### Docker Development

Build and test locally:

```sh
# Build local Docker image
npm run docker:build-local

# Run locally built image
docker run -p 3000:3000 hellocoop/mcp:local
```

### Publishing

For maintainers publishing to Docker Hub:

```sh
npm run docker:publish
```

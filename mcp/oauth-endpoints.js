// OAuth endpoints and well-known metadata generation
// Shared between CLI and server modes

const DEFAULT_DOMAIN = 'hello.coop';

export function getDomain() {
  return process.env.HELLO_DOMAIN || DEFAULT_DOMAIN;
}

export function getAdminBaseUrl() {
  return process.env.HELLO_ADMIN || `https://admin.${getDomain()}`;
}

export function getMcpBaseUrl() {
  return process.env.HELLO_MCP || `https://mcp.${getDomain()}`;
}

export function getWalletBaseUrl() {
  return process.env.HELLO_WALLET || `https://wallet.${getDomain()}`;
}

export function getIssuerBaseUrl() {
  return process.env.HELLO_ISSUER || `https://issuer.${getDomain()}`;
}

// OAuth Authorization Server Metadata (RFC 8414)
export function getAuthServerMetadata() {
  const domain = getDomain();
  const mcpBase = getMcpBaseUrl();
  const walletBase = getWalletBaseUrl();
  const adminBase = getAdminBaseUrl();
  const issuerBase = getIssuerBaseUrl();

  return {
    issuer: mcpBase,
    authorization_endpoint: `${walletBase}/authorize`,
    token_endpoint: `${walletBase}/oauth/token`,
    registration_endpoint: `${adminBase}/register/mcp`,
    jwks_uri: `${issuerBase}/.well-known/jwks`,
    scopes_supported: ['mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

// OAuth Protected Resource Metadata (RFC 8707)
export function getProtectedResourceMetadata() {
  const mcpBase = getMcpBaseUrl();

  return {
    resource: `${mcpBase}/mcp`,
    authorization_servers: [mcpBase],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  };
}

// Express/Fastify route handlers
export function createWellKnownHandlers() {
  return {
    authServer: async (req, res) => {
      console.log('Well-Known OAuth Server Request:', req.url || req.path);
      const metadata = getAuthServerMetadata();
      
      if (res.send) {
        // Express-style
        res.json(metadata);
      } else {
        // Node.js http response style
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metadata, null, 2));
      }
    },

    protectedResource: async (req, res) => {
      console.log('Well-Known Protected Resource Request:', req.url || req.path);
      const metadata = getProtectedResourceMetadata();
      
      if (res.send) {
        // Express-style
        res.json(metadata);
      } else {
        // Node.js http response style
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metadata, null, 2));
      }
    }
  };
} 
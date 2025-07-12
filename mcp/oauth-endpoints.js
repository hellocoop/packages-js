// OAuth endpoints and well-known metadata
// Static configuration with environment variable overrides

// Domain constants
const DEFAULT_DOMAIN = 'hello.coop';
export const DOMAIN = process.env.HELLO_DOMAIN || DEFAULT_DOMAIN;

// Base URL constants
export const ADMIN_BASE_URL = process.env.HELLO_ADMIN || `https://admin.${DOMAIN}`;
export const MCP_BASE_URL = process.env.HELLO_MCP || `https://mcp.${DOMAIN}`;
export const WALLET_BASE_URL = process.env.HELLO_WALLET || `https://wallet.${DOMAIN}`;
export const ISSUER_BASE_URL = process.env.HELLO_ISSUER || `https://issuer.${DOMAIN}`;

// OAuth Authorization Server Metadata (RFC 8414)
export const OAUTH_AUTH_SERVER_METADATA = {
  issuer: MCP_BASE_URL,
  authorization_endpoint: `${WALLET_BASE_URL}/authorize`,
  token_endpoint: `${WALLET_BASE_URL}/oauth/token`,
  registration_endpoint: `${ADMIN_BASE_URL}/register/mcp`,
  jwks_uri: `${ISSUER_BASE_URL}/.well-known/jwks`,
  scopes_supported: ['mcp'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};

// OAuth Protected Resource Metadata (RFC 8707)
export const OAUTH_PROTECTED_RESOURCE_METADATA = {
  resource: `${MCP_BASE_URL}/mcp`,
  authorization_servers: [MCP_BASE_URL],
  scopes_supported: ['mcp'],
  bearer_methods_supported: ['header'],
};

// Express/Fastify route handlers
export function createWellKnownHandlers() {
  return {
    authServer: async (req, res) => {
      console.log('Well-Known OAuth Server Request:', req.url || req.path);
      
      if (res.send) {
        // Express-style
        res.json(OAUTH_AUTH_SERVER_METADATA);
      } else {
        // Node.js http response style
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(OAUTH_AUTH_SERVER_METADATA, null, 2));
      }
    },

    protectedResource: async (req, res) => {
      console.log('Well-Known Protected Resource Request:', req.url || req.path);
      
      if (res.send) {
        // Express-style
        res.json(OAUTH_PROTECTED_RESOURCE_METADATA);
      } else {
        // Node.js http response style
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(OAUTH_PROTECTED_RESOURCE_METADATA, null, 2));
      }
    }
  };
}

// Legacy function exports for backward compatibility
export function getDomain() {
  return DOMAIN;
}

export function getAdminBaseUrl() {
  return ADMIN_BASE_URL;
}

export function getMcpBaseUrl() {
  return MCP_BASE_URL;
}

export function getWalletBaseUrl() {
  return WALLET_BASE_URL;
}

export function getIssuerBaseUrl() {
  return ISSUER_BASE_URL;
}

export function getAuthServerMetadata() {
  return OAUTH_AUTH_SERVER_METADATA;
}

export function getProtectedResourceMetadata() {
  return OAUTH_PROTECTED_RESOURCE_METADATA;
} 
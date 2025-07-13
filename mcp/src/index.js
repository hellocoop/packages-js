// Main entry for @hellocoop/mcp package
// Exports the core MCP server functionality for programmatic use

import { HelloMCPServer } from './mcp-server.js';
import * as oauthEndpoints from './oauth-endpoints.js';

export {
  // Core MCP server with Hello admin tools
  HelloMCPServer,
  
  // OAuth endpoints and configuration
  oauthEndpoints
}; 
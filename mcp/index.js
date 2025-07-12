// Main entry for @hellocoop/mcp package
// Exports the core MCP server components for programmatic use

import { HelloMCPServer } from './mcp-server.js';
import { MCPHttpServer } from './server.js';
import { MCPCLIServer } from './bin/cli.js';
import * as oauthEndpoints from './oauth-endpoints.js';

// Main function for backward compatibility
function startMCP(options = {}) {
  console.log('Use MCPCLIServer for CLI mode or MCPHttpServer for HTTP mode');
  console.log('Example:');
  console.log('  import { MCPCLIServer } from "@hellocoop/mcp";');
  console.log('  const cli = new MCPCLIServer();');
  console.log('  await cli.start();');
}

export {
  // Core MCP server (shared logic)
  HelloMCPServer,
  
  // HTTP server for Docker deployment
  MCPHttpServer,
  
  // CLI server for stdio transport
  MCPCLIServer,
  
  // OAuth endpoints utilities
  oauthEndpoints,
  
  // Backward compatibility
  startMCP
}; 
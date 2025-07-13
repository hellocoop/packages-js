// MCP Server for @hellocoop/mcp (refactored for REST API calls)
// Requires Node.js 18+ for built-in fetch
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ADMIN_BASE_URL } from './oauth-endpoints.js';

export class HelloMCPServer {
  constructor() {
    this.mcpServer = new Server(
      {
        name: 'hello-admin-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          authorization: {},
          logging: {}
        }
      }
    );
    this.accessToken = null;
    this.adminUser = null;
    this.authenticationCallback = null;
    this.setupHandlers();
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  setAuthenticationCallback(callback) {
    this.authenticationCallback = callback;
  }

  async handleRequest(request) {
    // Handle MCP JSON-RPC requests
    const { jsonrpc, id, method, params } = request;

    if (jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request - jsonrpc must be "2.0"'
        }
      };
    }

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                resources: {},
                logging: {}
              },
              serverInfo: {
                name: '@hellocoop/mcp',
                version: '1.0.0'
              }
            }
          };

        case 'initialized':
          return {
            jsonrpc: '2.0',
            id,
            result: {}
          };

        case 'tools/list':
          const toolsHandler = this.mcpServer._requestHandlers.get('tools/list');
          if (toolsHandler) {
            const toolsResult = await toolsHandler({ method: 'tools/list', params: params || {} });
            return {
              jsonrpc: '2.0',
              id,
              result: toolsResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              result: { tools: [] }
            };
          }

        case 'tools/call':
          const callHandler = this.mcpServer._requestHandlers.get('tools/call');
          if (callHandler) {
            const callResult = await callHandler({ 
              method: 'tools/call', 
              params: { name: params.name, arguments: params.arguments || {} }
            });
            return {
              jsonrpc: '2.0',
              id,
              result: callResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
          }

        case 'ping':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              pong: true,
              timestamp: new Date().toISOString(),
              server: '@hellocoop/mcp',
              version: '1.0.0'
            }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        }
      };
    }
  }

  // REST call to admin API using built-in fetch
  async callAdminAPI(method, path, data, options = {}) {
    const { requiresAuth = true, isRetry = false } = options;
    
    // Trigger authentication if we need auth but don't have a token
    if (requiresAuth && !this.accessToken && this.authenticationCallback) {
      try {
        this.accessToken = await this.authenticationCallback();
      } catch (error) {
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }

    const url = ADMIN_BASE_URL + path;
    const headers = {
      'Content-Type': 'application/json',
      ...(requiresAuth && this.accessToken && { Authorization: `Bearer ${this.accessToken}` })
    };

    const requestOptions = {
      method: method.toUpperCase(),
      headers
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestOptions);
      const responseData = await response.json();
      
      // Handle token expiration (401 Unauthorized)
      if (response.status === 401 && requiresAuth && !isRetry && this.authenticationCallback) {
        this.accessToken = null; // Clear expired token
        
        try {
          // Trigger new OAuth flow
          this.accessToken = await this.authenticationCallback();
          
          // Retry the original request with new token
          return await this.callAdminAPI(method, path, data, { requiresAuth, isRetry: true });
        } catch (authError) {
          throw new Error(`Re-authentication failed: ${authError.message}`);
        }
      }
      
      if (!response.ok) {
        return responseData;
      }
      
      return responseData;
          } catch (err) {
        throw new Error(`API call failed: ${err.message}`);
      }
  }

  setupHandlers() {
    // ListTools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'hello_get_profile',
            description: 'Get your Hellō developer profile and publishers',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'Optional specific publisher ID'
                }
              }
            }
          },
          {
            name: 'hello_create_publisher',
            description: 'Create a new Hellō publisher (team/organization)',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the publisher/team (defaults to "[Your Name]\'s Team")'
                }
              }
            }
          },
          {
            name: 'hello_update_publisher',
            description: 'Update/rename a Hellō publisher',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to update'
                },
                name: {
                  type: 'string',
                  description: 'New name for the publisher'
                }
              },
              required: ['publisher_id', 'name']
            }
          },
          {
            name: 'hello_read_publisher',
            description: 'Read detailed information about a specific Hellō publisher including all applications with full configuration',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to read'
                }
              },
              required: ['publisher_id']
            }
          },
          {
            name: 'hello_read_application',
            description: 'Read detailed information about a specific Hellō application including redirect URIs',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher that owns the application'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application to read'
                }
              },
              required: ['publisher_id', 'application_id']
            }
          },
          {
            name: 'hello_create_application',
            description: 'Create a new Hellō application under a publisher.',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to create the app under'
                },
                name: {
                  type: 'string',
                  description: 'Application name (defaults to "[Your Name]\'s MCP Created App")'
                },
                dev_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Development redirect URIs',
                  default: []
                },
                prod_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Production redirect URIs',
                  default: []
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow',
                  default: false
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI (optional)'
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development',
                  default: true
                },
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development',
                  default: true
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI (optional)'
                },
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI (optional)'
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development',
                  default: false
                }
              },
              required: ['publisher_id']
            }
          },
          {
            name: 'hello_update_application',
            description: 'Update a Hellō application',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application to update'
                },
                name: {
                  type: 'string',
                  description: 'Application name'
                },
                dev_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Development redirect URIs'
                },
                prod_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Production redirect URIs'
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow'
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI'
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development'
                },
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development'
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI'
                },
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI'
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development'
                }
              },
              required: ['publisher_id', 'application_id']
            }
          },
          {
            name: 'hello_admin_version',
            description: 'Get Admin API version information',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Tool call handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'hello_get_profile': {
            // GET /api/v1/profile or /api/v1/profile/:publisher
            let path = '/api/v1/profile';
            if (args.publisher_id) path += `/${args.publisher_id}`;
            const result = await this.callAdminAPI('get', path);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          case 'hello_create_publisher': {
            // POST /api/v1/publishers
            return await this.callAdminAPI('post', '/api/v1/publishers', { name: args.name });
          }
          case 'hello_update_publisher': {
            // PUT /api/v1/publishers/:publisher
            return await this.callAdminAPI('put', `/api/v1/publishers/${args.publisher_id}`, { name: args.name });
          }
          case 'hello_read_publisher': {
            // GET /api/v1/publishers/:publisher
            return await this.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}`);
          }
          case 'hello_read_application': {
            // GET /api/v1/publishers/:publisher/applications/:application
            return await this.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`);
          }
          case 'hello_create_application': {
            // POST /api/v1/publishers/:publisher/applications
            return await this.callAdminAPI('post', `/api/v1/publishers/${args.publisher_id}/applications`, args);
          }
          case 'hello_update_application': {
            // PUT /api/v1/publishers/:publisher/applications/:application
            return await this.callAdminAPI('put', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`, args);
          }
          case 'hello_admin_version': {
            // GET /api/v1/version - no authentication required
            return await this.callAdminAPI('get', '/api/v1/version', null, { requiresAuth: false });
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        // Token error handling
        if (err.response && err.response.status === 401) {
          return {
            error: 'invalid_token',
            error_description: 'Access token is invalid or expired',
            'WWW-Authenticate': 'Bearer error="invalid_token"'
          };
        }
        if (err.response && err.response.status === 403) {
          return {
            error: 'insufficient_scope',
            error_description: 'Insufficient scope for this operation',
            'WWW-Authenticate': 'Bearer error="insufficient_scope"'
          };
        }
        return { error: err.message };
      }
    });
  }
} 
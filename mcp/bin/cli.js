#!/usr/bin/env node

// MCP CLI with OAuth flow and stdio transport
// Launches OAuth flow to get tokens and provides stdio interface

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HelloMCPServer } from '../mcp-server.js';
import { getWalletBaseUrl, getAdminBaseUrl, createWellKnownHandlers } from '../oauth-endpoints.js';
import http from 'http';
import url from 'url';
import open from 'open';
import crypto from 'crypto';

class MCPCLIServer {
  constructor() {
    this.mcpServer = new HelloMCPServer();
    this.accessToken = null;
    this.localServer = null;
    this.localPort = 3000; // Default port for OAuth callback
    this.authInProgress = false;
    this.authPromise = null;
  }

  async start() {
    console.error('Starting @hellocoop/mcp CLI...');
    console.error('HELLO_DOMAIN:', process.env.HELLO_DOMAIN || 'default');
    console.error('HELLO_ADMIN:', process.env.HELLO_ADMIN || 'default');

    // Set up lazy authentication callback
    this.mcpServer.setAuthenticationCallback(async () => {
      if (!this.accessToken && !this.authInProgress) {
        console.error('Authentication required. Starting OAuth flow...');
        await this.performOAuthFlow();
      }
      return this.accessToken;
    });

    // Set up stdio transport
    const transport = new StdioServerTransport();
    await this.mcpServer.mcpServer.connect(transport);
    
    console.error('MCP server running on stdio. Ready for agent/client requests.');
    console.error('OAuth flow will start automatically when needed.');
  }

  async ensureAuthenticated() {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (this.authInProgress) {
      // Wait for existing auth flow to complete
      return await this.authPromise;
    }

    this.authInProgress = true;
    this.authPromise = this.performOAuthFlow();
    
    try {
      await this.authPromise;
      return this.accessToken;
    } finally {
      this.authInProgress = false;
      this.authPromise = null;
    }
  }

  async performOAuthFlow() {
    try {
      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(16).toString('hex');

      // Find available port for callback server
      this.localPort = await this.findAvailablePort(3000);
      const redirectUri = `http://localhost:${this.localPort}/callback`;

      // Start local callback server (serves the auth page)
      await this.startCallbackServer(state, codeVerifier);

      // Wait for callback (user will click button on the served page)
      const authCode = await this.waitForCallback();

      // Exchange code for token
      await this.exchangeCodeForToken(authCode, codeVerifier, redirectUri);

      // Stop callback server
      await this.stopCallbackServer();

      console.error('Authentication successful!');

    } catch (error) {
      console.error('OAuth flow failed:', error.message);
      throw error; // Don't exit process, let the caller handle it
    }
  }

  generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  async findAvailablePort(startPort) {
    const net = await import('net');
    
    return new Promise((resolve, reject) => {
      const server = net.default.createServer();
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', () => {
        // Try next port
        this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
      });
    });
  }

  async startCallbackServer(expectedState, codeVerifier) {
    return new Promise((resolve, reject) => {
      // Store for callback resolution
      this.callbackResolve = null;
      this.callbackReject = null;

      // Store auth parameters for the button endpoint
      this.authParams = {
        state: expectedState,
        codeVerifier: codeVerifier
      };

      this.localServer = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/') {
          // Serve the main page with "Continue with Hellō" button
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hellō MCP Authentication</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 400px;
        }
        h1 {
            margin-bottom: 1rem;
            font-size: 2rem;
            font-weight: 300;
        }
        p {
            margin-bottom: 2rem;
            opacity: 0.9;
            line-height: 1.6;
        }
        .hello-btn {
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 1rem 2rem;
            font-size: 1.1rem;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
        }
        .hello-btn:hover {
            background: #ff5252;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }
        .status {
            margin-top: 1rem;
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .server-info {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Hellō MCP</h1>
        <p>Ready to authenticate with your Hellō account for MCP access.</p>
        
        <button class="hello-btn" onclick="startAuth()">
            Continue with Hellō
        </button>
        
        <div class="status" id="status">
            Click the button above to start authentication
        </div>
        
        <div class="server-info">
            <strong>Server Status:</strong> ✅ Running<br>
            <strong>Port:</strong> ${this.localPort}<br>
            <strong>Mode:</strong> MCP CLI Authentication
        </div>
    </div>

    <script>
        async function startAuth() {
            const statusEl = document.getElementById('status');
            const btn = document.querySelector('.hello-btn');
            
            try {
                statusEl.textContent = 'Generating authorization URL...';
                btn.disabled = true;
                btn.textContent = 'Please wait...';
                
                const response = await fetch('/auth/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.authUrl) {
                    statusEl.textContent = 'Redirecting to Hellō...';
                    window.location.href = data.authUrl;
                } else {
                    throw new Error(data.error || 'Failed to generate auth URL');
                }
            } catch (error) {
                statusEl.textContent = 'Error: ' + error.message;
                btn.disabled = false;
                btn.textContent = 'Continue with Hellō';
            }
        }
    </script>
</body>
</html>
          `);
        } else if (parsedUrl.pathname === '/auth/start') {
          // Generate and return the authorization URL
          res.writeHead(200, { 'Content-Type': 'application/json' });
          
          try {
            const redirectUri = `http://localhost:${this.localPort}/callback`;
            const walletBase = getWalletBaseUrl();
            const authUrl = new URL('/authorize', walletBase);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', 'mcp-cli');
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('scope', 'mcp');
            authUrl.searchParams.set('state', this.authParams.state);
            authUrl.searchParams.set('code_challenge', this.generateCodeChallenge(this.authParams.codeVerifier));
            authUrl.searchParams.set('code_challenge_method', 'S256');
            
            res.end(JSON.stringify({ authUrl: authUrl.toString() }));
          } catch (error) {
            res.end(JSON.stringify({ error: error.message }));
          }
        } else if (parsedUrl.pathname === '/callback') {
          const { code, state, error } = parsedUrl.query;

          res.writeHead(200, { 'Content-Type': 'text/html' });

          if (error) {
            res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 2rem; }
        .error { color: #ff6b6b; background: #fff5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    </style>
</head>
<body>
    <h1>❌ Authentication Failed</h1>
    <div class="error">Error: ${error}</div>
    <p>You can close this window and try again.</p>
</body>
</html>
            `);
            if (this.callbackReject) {
              this.callbackReject(new Error(`OAuth error: ${error}`));
            }
            return;
          }

          if (state !== expectedState) {
            res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 2rem; }
        .error { color: #ff6b6b; background: #fff5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    </style>
</head>
<body>
    <h1>❌ Authentication Failed</h1>
    <div class="error">Invalid state parameter</div>
    <p>You can close this window and try again.</p>
</body>
</html>
            `);
            if (this.callbackReject) {
              this.callbackReject(new Error('Invalid state parameter'));
            }
            return;
          }

          if (!code) {
            res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 2rem; }
        .error { color: #ff6b6b; background: #fff5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    </style>
</head>
<body>
    <h1>❌ Authentication Failed</h1>
    <div class="error">No authorization code received</div>
    <p>You can close this window and try again.</p>
</body>
</html>
            `);
            if (this.callbackReject) {
              this.callbackReject(new Error('No authorization code received'));
            }
            return;
          }

          res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 2rem; }
        .success { color: #51cf66; background: #f3fff3; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    </style>
</head>
<body>
    <h1>✅ Authentication Successful!</h1>
    <div class="success">You have been successfully authenticated with Hellō.</div>
    <p>You can close this window and return to the CLI.</p>
</body>
</html>
          `);
          
          if (this.callbackResolve) {
            this.callbackResolve(code);
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Not Found</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 2rem; }
    </style>
</head>
<body>
    <h1>404 - Not Found</h1>
    <p><a href="/">← Back to authentication</a></p>
</body>
</html>
          `);
        }
      });

      this.localServer.listen(this.localPort, 'localhost', async () => {
        const serverUrl = `http://localhost:${this.localPort}`;
        console.error(`🌐 OAuth server started: ${serverUrl}`);
        console.error(`📱 Opening browser automatically...`);
        
        try {
          await open(serverUrl);
          console.error(`✅ Browser opened to: ${serverUrl}`);
        } catch (error) {
          console.error(`⚠️  Could not open browser automatically: ${error.message}`);
          console.error(`📱 Please manually open: ${serverUrl}`);
        }
        
        resolve();
      });

      this.localServer.on('error', reject);
    });
  }

  async waitForCallback() {
    return new Promise((resolve, reject) => {
      this.callbackResolve = resolve;
      this.callbackReject = reject;
      
      // Timeout after 5 minutes
      setTimeout(() => {
        reject(new Error('OAuth flow timed out after 5 minutes'));
      }, 5 * 60 * 1000);
    });
  }

  async exchangeCodeForToken(code, codeVerifier, redirectUri) {
    try {
      const walletBase = getWalletBaseUrl();
      const tokenUrl = `${walletBase}/oauth/token`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: 'mcp-cli',
          code_verifier: codeVerifier
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${data.error || response.statusText}`);
      }

      if (data.access_token) {
        this.accessToken = data.access_token;
        this.mcpServer.accessToken = this.accessToken;
        console.error('Access token acquired successfully');
      } else {
        throw new Error('No access token in response');
      }

    } catch (error) {
      console.error('Token exchange failed:', error.message);
      throw error;
    }
  }

  async stopCallbackServer() {
    if (this.localServer) {
      return new Promise((resolve) => {
        this.localServer.close(resolve);
      });
    }
  }
}

// Start CLI if this file is run directly
// In ES modules, we check if the current module is the main module differently
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const cli = new MCPCLIServer();
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down gracefully');
    await cli.stopCallbackServer();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down gracefully');
    await cli.stopCallbackServer();
    process.exit(0);
  });

  cli.start().catch(error => {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  });
}

export { MCPCLIServer };

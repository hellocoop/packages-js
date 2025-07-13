#!/usr/bin/env node

// MCP CLI with OAuth flow and stdio transport
// Launches OAuth flow to get tokens and provides stdio interface

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HelloMCPServer } from './mcp-server.js';
import { WALLET_BASE_URL, MCP_CLIENT_ID } from './oauth-endpoints.js';
import { pkce } from '@hellocoop/helper-server';
import http from 'http';
import url from 'url';
import open from 'open';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // Set up lazy authentication callback
    this.mcpServer.setAuthenticationCallback(() => this.ensureAuthenticated());

    // Start stdio transport
    const transport = new StdioServerTransport();
    await this.mcpServer.mcpServer.connect(transport);
  }

  async ensureAuthenticated() {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (this.authInProgress) {
      return this.authPromise;
    }

    this.authInProgress = true;
    this.authPromise = this.performOAuthFlow();
    
    try {
      const token = await this.authPromise;
      return token;
    } finally {
      this.authInProgress = false;
      this.authPromise = null;
    }
  }

  async performOAuthFlow() {
    try {
      // Generate PKCE parameters
      const pkceMaterial = await pkce();
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();

      // Create authorization URL
      const authUrl = this.createAuthorizationUrl({
        client_id: MCP_CLIENT_ID,
        redirect_uri: `http://localhost:${this.localPort}/callback`,
        scope: ['mcp'],
        code_challenge: pkceMaterial.code_challenge,
        code_challenge_method: 'S256',
        state,
        nonce
      });

      // Start local callback server
      const authCode = await this.startCallbackServer(state, authUrl);

      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken({
        code: authCode,
        code_verifier: pkceMaterial.code_verifier,
        client_id: MCP_CLIENT_ID,
        redirect_uri: `http://localhost:${this.localPort}/callback`
      });

      this.accessToken = tokenResponse.access_token;
      return this.accessToken;

    } catch (error) {
      throw error;
    }
  }

  createAuthorizationUrl(params) {
    const urlParams = new URLSearchParams({
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      scope: params.scope.join(' '),
      response_type: 'code',
      response_mode: 'query',
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      state: params.state,
      nonce: params.nonce
    });

    return `${WALLET_BASE_URL}/authorize?${urlParams.toString()}`;
  }

  async startCallbackServer(expectedState, authUrl) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/callback') {
          const { code, state, error } = parsedUrl.query;
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Error</h1><p>${error}</p>`);
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (state !== expectedState) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Error</h1><p>Invalid state parameter</p>');
            reject(new Error('Invalid state parameter'));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Error</h1><p>No authorization code received</p>');
            reject(new Error('No authorization code received'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          const successHtml = fs.readFileSync(path.join(__dirname, 'auth-success.html'), 'utf8');
          res.end(successHtml);
          
          resolve(code);
        } else {
          // Serve the login page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          const loginHtml = fs.readFileSync(path.join(__dirname, 'auth-login.html'), 'utf8');
          const htmlWithAuthUrl = loginHtml.replace('{{AUTH_URL}}', authUrl);
          res.end(htmlWithAuthUrl);
        }
      });

      server.listen(this.localPort, () => {
        open(authUrl);
      });

      server.on('error', (err) => {
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });

      this.localServer = server;
    });
  }

  async exchangeCodeForToken(params) {
    const tokenEndpoint = `${WALLET_BASE_URL}/oauth/token`;
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.code_verifier,
      client_id: params.client_id,
      redirect_uri: params.redirect_uri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access_token in response');
    }

    return tokenData;
  }

  async stopCallbackServer() {
    if (this.localServer) {
      return new Promise((resolve) => {
        this.localServer.close(() => {
          this.localServer = null;
          resolve();
        });
      });
    }
  }
}

// Start the CLI server
const cli = new MCPCLIServer();
cli.start().catch((error) => {
  console.error('Failed to start MCP CLI:', error);
  process.exit(1);
});

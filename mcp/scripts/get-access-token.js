#!/usr/bin/env node

// Script to get access token via OAuth flow
// Outputs token response as JSON for piping to other commands

import { WALLET_BASE_URL, MCP_CLIENT_ID } from '../src/oauth-endpoints.js';
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

class TokenGetter {
  constructor() {
    this.localPort = 3000;
    this.localServer = null;
  }

  async getAccessToken() {
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

      // Output as JSON
      console.log(JSON.stringify(tokenResponse, null, 2));

      return tokenResponse;

    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  createAuthorizationUrl(params) {
    const authUrl = new URL(`${WALLET_BASE_URL}/authorize`);
    authUrl.searchParams.set('client_id', params.client_id);
    authUrl.searchParams.set('redirect_uri', params.redirect_uri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', params.scope.join(' '));
    authUrl.searchParams.set('code_challenge', params.code_challenge);
    authUrl.searchParams.set('code_challenge_method', params.code_challenge_method);
    authUrl.searchParams.set('state', params.state);
    authUrl.searchParams.set('nonce', params.nonce);
    return authUrl.toString();
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
          const successHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'auth-success.html'), 'utf8');
          res.end(successHtml);
          
          // Close server after successful callback
          server.close();
          resolve(code);
        } else {
          // Serve the login page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'auth-login.html'), 'utf8');
          const htmlWithAuthUrl = loginHtml.replace('{{AUTH_URL}}', authUrl);
          res.end(htmlWithAuthUrl);
        }
      });

      server.listen(this.localPort, () => {
        console.error(`🌐 Opening browser for authentication...`);
        console.error(`📱 If browser doesn't open, visit: http://localhost:${this.localPort}`);
        open(`http://localhost:${this.localPort}`);
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
}

// Handle command line arguments
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Usage: node get-access-token.js [options]

Options:
  --help, -h    Show this help message

Description:
  Performs OAuth flow to get access token and outputs token response as JSON.
  
Examples:
  # Get token and save to file
  node get-access-token.js > token.json
  
  # Extract just the access token
  node get-access-token.js | jq -r '.access_token'
  
  # Use token in curl command
  TOKEN=$(node get-access-token.js | jq -r '.access_token')
  curl -H "Authorization: Bearer $TOKEN" https://admin.hello.coop/api/v1/profile
  
  # For testing with different domains
  node get-access-token.js
`);
  process.exit(0);
}

// Run the token getter
const tokenGetter = new TokenGetter();
tokenGetter.getAccessToken(); 
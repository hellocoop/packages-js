#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✅ ${name}${details ? ` - ${details}` : ''}`);
  } else {
    failedTests++;
    console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
  }
}

function logSection(title) {
  console.log(`\n🧪 ${title}`);
  console.log('='.repeat(50));
}

// Test 1: Basic MCP Protocol (stdio)
async function testStdioProtocol() {
  logSection('Testing stdio MCP Protocol');
  
  const cli = spawn('node', ['../src/stdio.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let responses = [];
  let errors = [];
  
  cli.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.startsWith('{')) {
      try {
        const response = JSON.parse(output);
        responses.push(response);
      } catch (e) {
        errors.push(`JSON parse error: ${e.message}`);
      }
    }
  });

  cli.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (error) errors.push(error);
  });

  // Test requests
  const testRequests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    }
  ];

  // Send test requests
  for (const request of testRequests) {
    cli.stdin.write(JSON.stringify(request) + '\n');
  }

  // Wait for responses
  await setTimeout(2000);
  cli.kill();

  // Validate responses
  logTest('stdio server starts', responses.length > 0);
  
  const initResponse = responses.find(r => r.id === 1);
  logTest('initialize response', initResponse && initResponse.result);
  
  const toolsResponse = responses.find(r => r.id === 2);
  logTest('tools/list response', toolsResponse && toolsResponse.result && toolsResponse.result.tools);
  
  if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
    const tools = toolsResponse.result.tools.map(t => t.name);
    const expectedTools = ['hello_get_profile', 'hello_create_publisher', 'hello_update_publisher'];
    const hasExpectedTools = expectedTools.every(tool => tools.includes(tool));
    logTest('expected tools present', hasExpectedTools, `Found ${tools.length} tools`);
  }

  return errors.length === 0;
}

// Test 2: HTTP Server and CORS
async function testHttpServerAndCORS() {
  logSection('Testing HTTP Server and CORS');
  
  // Start HTTP server
  const server = spawn('node', ['../src/http.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname,
    env: { ...process.env, PORT: '3001' }
  });

  // Wait for server to start
  await setTimeout(2000);

  try {
    // Test 1: Health check
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    });
    logTest('health endpoint', healthResponse.statusCode === 200);

    // Test 2: CORS preflight
    const corsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/mcp',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });
    logTest('CORS preflight', corsResponse.statusCode === 204);
    logTest('CORS origin header', corsResponse.headers['access-control-allow-origin'] === 'https://example.com');
    logTest('CORS methods header', corsResponse.headers['access-control-allow-methods']?.includes('POST'));
    logTest('CORS headers header', corsResponse.headers['access-control-allow-headers']?.includes('Authorization'));
    logTest('CORS max-age header', corsResponse.headers['access-control-max-age'] === '86400');

    // Test 3: MCP initialize via HTTP
    const testOrigin = 'https://console.hello.coop';
    const mcpResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': testOrigin
      }
    }, JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" }
      }
    }));
    
    logTest('HTTP MCP initialize', mcpResponse.statusCode === 200);
    logTest('HTTP CORS origin response', mcpResponse.headers['access-control-allow-origin'] === testOrigin);
    
    if (mcpResponse.body) {
      try {
        const mcpData = JSON.parse(mcpResponse.body);
        logTest('HTTP MCP JSON response', mcpData.jsonrpc === '2.0' && mcpData.result);
      } catch (e) {
        logTest('HTTP MCP JSON response', false, 'Invalid JSON');
      }
    }

    // Test 4: OAuth well-known endpoints
    const oauthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/.well-known/oauth-authorization-server',
      method: 'GET'
    });
    logTest('OAuth well-known endpoint', oauthResponse.statusCode === 200);
    
    if (oauthResponse.body) {
      try {
        const oauthData = JSON.parse(oauthResponse.body);
        logTest('OAuth metadata format', oauthData.issuer && oauthData.authorization_endpoint);
      } catch (e) {
        logTest('OAuth metadata format', false, 'Invalid JSON');
      }
    }

  } catch (error) {
    logTest('HTTP server tests', false, error.message);
  } finally {
    server.kill();
  }
}

// Test 3: Version tool (no auth required)
async function testVersionTool() {
  logSection('Testing Version Tool (No Auth)');
  
  const cli = spawn('node', ['../src/stdio.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let responses = [];
  
  cli.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.startsWith('{')) {
      try {
        const response = JSON.parse(output);
        responses.push(response);
      } catch (e) {
        // Ignore parse errors for this test
      }
    }
  });

  // Send requests
  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" }
      }
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "hello_admin_version",
        arguments: {}
      }
    }
  ];

  for (const request of requests) {
    cli.stdin.write(JSON.stringify(request) + '\n');
  }

  await setTimeout(3000);
  cli.kill();

  const versionResponse = responses.find(r => r.id === 2);
  logTest('version tool call', versionResponse && versionResponse.result);
  
  if (versionResponse && versionResponse.result) {
    logTest('version tool data', versionResponse.result.VERSION && versionResponse.result.HOST);
  }
}

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting MCP Test Suite');
  console.log('🌐 Domain:', process.env.HELLO_DOMAIN || 'hello.coop');
  console.log('');

  try {
    await testStdioProtocol();
    await testHttpServerAndCORS();
    await testVersionTool();
  } catch (error) {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests }; 
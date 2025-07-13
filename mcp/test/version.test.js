#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// Version test - calls a tool that doesn't require authentication
async function testVersion() {
  console.log('🔧 Testing @hellocoop/mcp version tool...');
  console.log('🌐 Domain:', process.env.HELLO_DOMAIN || 'hello.coop');
  
  const cli = spawn('node', ['bin/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      HELLO_DOMAIN: process.env.HELLO_DOMAIN || 'hello.coop'
    }
  });

  let responses = [];
  let errors = [];
  
  cli.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log('📥 CLI Output:', output);
    if (output.startsWith('{')) {
      try {
        const response = JSON.parse(output);
        responses.push(response);
        console.log('✅ JSON Response received:', response.id ? `ID ${response.id}` : 'notification');
      } catch (e) {
        // Not JSON, just log it
      }
    }
  });

  cli.stderr.on('data', (data) => {
    const error = data.toString().trim();
    errors.push(error);
    console.log('⚠️  CLI:', error);
  });

  cli.on('close', (code) => {
    console.log(`🏁 CLI exited with code ${code}`);
  });

  // Wait for CLI to start
  console.log('⏳ Waiting for CLI to start...');
  await setTimeout(3000);

  // Initialize the MCP connection
  console.log('📤 Sending initialize request...');
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "version-test-client", version: "1.0.0" }
    }
  };
  cli.stdin.write(JSON.stringify(initRequest) + '\n');
  await setTimeout(2000);

  // Call the version tool (no authentication required)
  console.log('📤 Calling hello_admin_version (no auth required)...');
  const toolRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "hello_admin_version",
      arguments: {}
    }
  };
  cli.stdin.write(JSON.stringify(toolRequest) + '\n');

  // Wait for tool response
  console.log('⏳ Waiting for tool response...');
  
  // Wait for tool response (ID 2)
  let toolResponse = null;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds total
  
  while (!toolResponse && attempts < maxAttempts) {
    await setTimeout(1000); // Check every second
    attempts++;
    
    // Look for response with ID 2 (our tool call)
    toolResponse = responses.find(r => r.id === 2);
    
    if (toolResponse) {
      console.log('✅ Tool response received:', JSON.stringify(toolResponse, null, 2));
      break;
    }
    
    if (attempts % 5 === 0) {
      console.log(`⏳ Still waiting for tool response... (${attempts}s)`);
    }
  }
  
  if (!toolResponse) {
    console.log('⚠️  No tool response received within timeout');
  }

  // Cleanup
  console.log('🧹 Cleaning up...');
  cli.kill('SIGTERM');
  await setTimeout(2000);

  console.log('✅ Version test completed!');
  
  if (toolResponse) {
    if (toolResponse.error) {
      console.log('❌ Tool call failed:', toolResponse.error);
    } else {
      console.log('✅ Tool call succeeded!');
      console.log('📋 Version info:', toolResponse.result);
    }
  }
}

testVersion().catch((error) => {
  console.error('💥 Version test failed:', error);
  process.exit(1);
}); 
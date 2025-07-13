#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// Test MCP requests
const testRequests = [
  // Initialize request
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  },
  // List tools request
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }
];

// Expected tools that should be available
const expectedTools = [
  'hello_get_profile',
  'hello_create_publisher',
  'hello_update_publisher',
  'hello_read_publisher',
  'hello_read_application',
  'hello_create_application',
  'hello_update_application'
];

async function testCLI() {
  console.log('🧪 Testing @hellocoop/mcp CLI...');
  
  const cli = spawn('node', ['bin/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let responses = [];
  let errors = [];
  
  cli.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.startsWith('{')) {
      try {
        const response = JSON.parse(output);
        responses.push(response);
        console.log('📥 Received response:', response.method || `ID ${response.id}`);
      } catch (e) {
        console.log('📥 Raw output:', output);
      }
    }
  });

  cli.stderr.on('data', (data) => {
    const error = data.toString().trim();
    errors.push(error);
    console.log('⚠️  CLI:', error);
  });

  let exitCode = null;
  cli.on('close', (code) => {
    exitCode = code;
    console.log(`🏁 CLI exited with code ${code}`);
  });

  // Wait for CLI to start
  console.log('⏳ Waiting for CLI to start...');
  await setTimeout(3000);

  // Send test requests
  for (const request of testRequests) {
    console.log(`📤 Sending: ${request.method}`);
    cli.stdin.write(JSON.stringify(request) + '\n');
    await setTimeout(1000);
  }

  // Wait for responses
  console.log('⏳ Waiting for responses...');
  await setTimeout(3000);
  
  // Gracefully shutdown
  cli.kill('SIGTERM');
  
  // Wait for exit
  await setTimeout(1000);

  // Validate results
  console.log('\n🔍 Validating results...');
  
  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: CLI should start successfully
  testsTotal++;
  const hasStartupMessage = errors.some(e => e.includes('MCP server running on stdio'));
  if (hasStartupMessage) {
    console.log('✅ CLI started successfully');
    testsPassed++;
  } else {
    console.log('❌ CLI failed to start');
  }

  // Test 2: Initialize should succeed
  testsTotal++;
  const initResponse = responses.find(r => r.id === 1);
  if (initResponse && initResponse.result && initResponse.result.serverInfo) {
    console.log('✅ Initialize request succeeded');
    console.log(`   Server: ${initResponse.result.serverInfo.name} v${initResponse.result.serverInfo.version}`);
    testsPassed++;
  } else {
    console.log('❌ Initialize request failed');
  }

  // Test 3: Tools list should return expected tools
  testsTotal++;
  const toolsResponse = responses.find(r => r.id === 2);
  if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
    const availableTools = toolsResponse.result.tools.map(t => t.name);
    const missingTools = expectedTools.filter(t => !availableTools.includes(t));
    
    if (missingTools.length === 0) {
      console.log('✅ All expected tools are available');
      console.log(`   Tools: ${availableTools.length} total`);
      testsPassed++;
    } else {
      console.log('❌ Missing expected tools:', missingTools);
    }
  } else {
    console.log('❌ Tools list request failed');
  }

  // Test 4: CLI should exit cleanly
  testsTotal++;
  if (exitCode === 0) {
    console.log('✅ CLI exited cleanly');
    testsPassed++;
  } else {
    console.log(`❌ CLI exited with error code: ${exitCode}`);
  }

  // Summary
  console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

// Run tests
testCLI().catch((error) => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});

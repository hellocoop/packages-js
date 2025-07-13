import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🧪 Interactive OAuth Flow Test');
console.log('===============================');

// Start HTTP server
console.log('🚀 Starting HTTP server...');
const httpServer = spawn('node', ['src/http.js'], {
    cwd: projectRoot,
    env: { 
        ...process.env, 
        HELLO_DOMAIN: process.env.HELLO_DOMAIN || 'hello.coop',
        PORT: '3000'
    },
    stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;

httpServer.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📡 Server:', output.trim());
    
    if (output.includes('Hello MCP Server running')) {
        serverReady = true;
        startMCPTest();
    }
});

httpServer.stderr.on('data', (data) => {
    console.error('❌ Server Error:', data.toString().trim());
});

// Wait a moment for server to start, then start MCP test
setTimeout(() => {
    if (!serverReady) {
        console.log('⏰ Server taking longer than expected, starting MCP test anyway...');
        startMCPTest();
    }
}, 2000);

function startMCPTest() {
    console.log('\n🔧 Starting MCP stdio server...');
    console.log('📋 This will trigger the OAuth flow - check your browser!');
    console.log('🌐 Expected URLs:');
    console.log('   - Login page: http://localhost:3000/oauth/authorize?...');
    console.log('   - Success page: http://localhost:3000/oauth/callback?...');
    
    const mcpServer = spawn('node', ['src/stdio.js'], {
        cwd: projectRoot,
        env: { 
            ...process.env, 
            HELLO_DOMAIN: process.env.HELLO_DOMAIN || 'hello.coop'
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    mcpServer.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            console.log('🔍 MCP Server:', output);
        }
    });

    // Send MCP initialization
    const initMessage = {
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
    };

    console.log('\n📤 Sending MCP initialize...');
    mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');

    // Wait for initialization response, then call profile tool
    setTimeout(() => {
        const profileMessage = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "hello_get_profile",
                arguments: {}
            }
        };

        console.log('📤 Calling hello_get_profile tool (this will trigger OAuth)...');
        mcpServer.stdin.write(JSON.stringify(profileMessage) + '\n');
    }, 1000);

    // Handle MCP responses
    let buffer = '';
    mcpServer.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    console.log('📥 MCP Response:', JSON.stringify(response, null, 2));
                    
                    if (response.result && response.result.content) {
                        const content = response.result.content[0];
                        if (content.text && content.text.includes('oauth/authorize')) {
                            console.log('\n🎉 SUCCESS! OAuth flow initiated!');
                            console.log('🌐 Check your browser for the authentication pages');
                            console.log('📱 The login page should be styled with the Hellō button');
                        }
                    }
                } catch (e) {
                    console.log('📝 MCP Output:', line);
                }
            }
        });
    });

    // Cleanup after 30 seconds
    setTimeout(() => {
        console.log('\n🛑 Cleaning up servers...');
        mcpServer.kill();
        httpServer.kill();
        
        setTimeout(() => {
            console.log('✅ Test completed!');
            console.log('💡 To run this test again: npm run test:oauth-interactive');
            process.exit(0);
        }, 1000);
    }, 30000);
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    if (httpServer) httpServer.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, cleaning up...');
    if (httpServer) httpServer.kill();
    process.exit(0);
});

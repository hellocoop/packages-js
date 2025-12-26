/**
 * Test for jwks signature type
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'

/**
 * Generate an Ed25519 key pair as JWK
 */
async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        {
            name: 'Ed25519',
        },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    return { privateJwk, publicJwk }
}

/**
 * Mock fetch for JWKS testing
 */
function setupMockFetch(publicJwk: JsonWebKey) {
    const originalFetch = globalThis.fetch

    // Create mock JWKS
    const mockJWKS = {
        keys: [
            {
                ...publicJwk,
                kid: 'key-1',
                use: 'sig',
            },
        ],
    }

    // Create mock metadata
    const mockMetadata = {
        issuer: 'https://agent.example',
        jwks_uri: 'https://agent.example/jwks.json',
    }

    // Mock fetch
    const mockFetch = async (
        url: string | URL | Request,
        init?: RequestInit,
    ) => {
        const urlStr = typeof url === 'string' ? url : url.toString()

        console.log('Mock fetch called for:', urlStr)

        if (urlStr === 'https://agent.example/.well-known/agent-server') {
            return new Response(JSON.stringify(mockMetadata), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        if (
            urlStr === 'https://agent.example/jwks.json' ||
            urlStr === 'https://agent.example'
        ) {
            return new Response(JSON.stringify(mockJWKS), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        // Fall back to original fetch for actual HTTP requests
        return originalFetch(url, init)
    }

    globalThis.fetch = mockFetch as any

    return {
        restore: () => {
            globalThis.fetch = originalFetch
        },
    }
}

test('jwks: GET request with direct JWKS URL', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Setup mock fetch
    const mock = setupMockFetch(publicJwk)

    try {
        // Sign a GET request
        const result = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks',
                id: 'https://agent.example',
                kid: 'key-1',
            },
            dryRun: true,
        })) as { headers: Headers }

        // Check headers
        assert.ok(result.headers.get('signature'))
        assert.ok(result.headers.get('signature-input'))
        assert.ok(result.headers.get('signature-key'))

        console.log('Generated headers:')
        console.log('Signature:', result.headers.get('signature'))
        console.log('Signature-Input:', result.headers.get('signature-input'))
        console.log('Signature-Key:', result.headers.get('signature-key'))

        // Verify (this will fetch the JWKS)
        const verifyResult = await verify({
            method: 'GET',
            url: 'https://api.example.com/data',
            headers: result.headers,
        })

        console.log('\nVerification result:', verifyResult)

        assert.strictEqual(verifyResult.verified, true)
        assert.strictEqual(verifyResult.keyType, 'jwks')
        assert.ok(verifyResult.jwks)
        assert.strictEqual(verifyResult.jwks?.id, 'https://agent.example')
        assert.strictEqual(verifyResult.jwks?.kid, 'key-1')
        assert.strictEqual(verifyResult.publicKey.kty, 'OKP')
    } finally {
        mock.restore()
    }
})

test('jwks: GET request with well-known metadata', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Setup mock fetch
    const mock = setupMockFetch(publicJwk)

    try {
        // Sign a request with well-known
        const result = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks',
                id: 'https://agent.example',
                kid: 'key-1',
                wellKnown: 'agent-server',
            },
            dryRun: true,
        })) as { headers: Headers }

        console.log(
            '\nGenerated Signature-Key with well-known:',
            result.headers.get('signature-key'),
        )

        // Verify (should fetch metadata first, then JWKS)
        const verifyResult = await verify({
            method: 'GET',
            url: 'https://api.example.com/data',
            headers: result.headers,
        })

        console.log('\nVerification result:', verifyResult)

        assert.strictEqual(verifyResult.verified, true)
        assert.strictEqual(verifyResult.keyType, 'jwks')
        assert.strictEqual(verifyResult.jwks?.id, 'https://agent.example')
        assert.strictEqual(verifyResult.jwks?.wellKnown, 'agent-server')
    } finally {
        mock.restore()
    }
})

test('jwks: POST request with body', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Setup mock fetch with different URL to avoid cache collision
    const originalFetch = globalThis.fetch
    const mockJWKS = {
        keys: [{ ...publicJwk, kid: 'key-post', use: 'sig' }],
    }
    globalThis.fetch = (async (
        url: string | URL | Request,
        init?: RequestInit,
    ) => {
        const urlStr = typeof url === 'string' ? url : url.toString()
        if (urlStr === 'https://agent-post.example') {
            return new Response(JSON.stringify(mockJWKS), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }
        return originalFetch(url, init)
    }) as any

    const mock = {
        restore: () => {
            globalThis.fetch = originalFetch
        },
    }

    try {
        const body = JSON.stringify({ data: 'test' })

        // Sign a POST request
        const result = (await fetch('https://api.example.com/resource', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body,
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks',
                id: 'https://agent-post.example',
                kid: 'key-post',
            },
            dryRun: true,
        })) as { headers: Headers }

        assert.ok(result.headers.get('content-digest'))

        // Verify
        const verifyResult = await verify({
            method: 'POST',
            url: 'https://api.example.com/resource',
            headers: result.headers,
            body,
        })

        console.log('\nPOST Verification result:', verifyResult)

        assert.strictEqual(
            verifyResult.verified,
            true,
            `Verification failed: ${verifyResult.error}`,
        )
        assert.strictEqual(verifyResult.keyType, 'jwks')
    } finally {
        mock.restore()
    }
})

test('jwks: Should fail if key not found in JWKS', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Setup mock fetch
    const mock = setupMockFetch(publicJwk)

    try {
        // Sign with a kid that doesn't exist
        const result = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks',
                id: 'https://agent.example',
                kid: 'nonexistent-key', // This key doesn't exist in mock JWKS
            },
            dryRun: true,
        })) as { headers: Headers }

        // Verification should fail
        const verifyResult = await verify({
            method: 'GET',
            url: 'https://api.example.com/data',
            headers: result.headers,
        })

        console.log('\nVerification result with missing key:', verifyResult)

        assert.strictEqual(verifyResult.verified, false)
        assert.ok(verifyResult.error?.includes('not found'))
    } finally {
        mock.restore()
    }
})

test('jwks: Caching should work (second verify should not re-fetch)', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    let fetchCount = 0
    const originalFetch = globalThis.fetch

    const mockJWKS = {
        keys: [
            {
                ...publicJwk,
                kid: 'key-cache',
                use: 'sig',
            },
        ],
    }

    const mockFetch = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString()

        if (urlStr === 'https://agent-cache.example') {
            fetchCount++
            console.log(`JWKS fetch #${fetchCount}`)
            return new Response(JSON.stringify(mockJWKS), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        return originalFetch(url)
    }

    globalThis.fetch = mockFetch as any

    try {
        // Sign a request
        const result = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks',
                id: 'https://agent-cache.example',
                kid: 'key-cache',
            },
            dryRun: true,
        })) as { headers: Headers }

        // First verify - should fetch JWKS
        const firstResult = await verify({
            method: 'GET',
            url: 'https://api.example.com/data',
            headers: result.headers,
        })

        console.log('\nFirst verify result:', firstResult)
        console.log('Fetch count after first verify:', fetchCount)

        assert.strictEqual(
            fetchCount,
            1,
            `Should have fetched JWKS once, but got ${fetchCount}`,
        )

        // Second verify - should use cache
        const secondResult = await verify({
            method: 'GET',
            url: 'https://api.example.com/data',
            headers: result.headers,
        })

        console.log('\nSecond verify result:', secondResult)
        console.log('Fetch count after second verify:', fetchCount)

        assert.strictEqual(
            fetchCount,
            1,
            'Should still only have fetched JWKS once (cached)',
        )

        console.log(
            '\nJWKS was cached successfully (fetched only once for two verifications)',
        )
    } finally {
        globalThis.fetch = originalFetch
    }
})

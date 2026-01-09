/**
 * Test edge cases and error handling
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'

/**
 * Generate an Ed25519 key pair
 */
async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey
    const publicJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey,
    )) as JsonWebKey

    return { privateJwk, publicJwk }
}

test('Content-Type: should default to text/plain for string body (matching fetch)', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: 'test data',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const contentType = headers.get('content-type')
    assert.strictEqual(
        contentType,
        'text/plain;charset=UTF-8',
        'Should default to text/plain;charset=UTF-8 for string body',
    )

    console.log(
        '✓ Content-Type defaults to text/plain;charset=UTF-8 for strings',
    )
})

test('Content-Type: should respect user-provided content-type', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const contentType = headers.get('content-type')
    assert.strictEqual(
        contentType,
        'application/json',
        'Should preserve user-provided content-type',
    )

    console.log('✓ User-provided Content-Type is preserved')
})

test('Invalid signing key: should throw error for missing kty', async () => {
    const invalidKey = { x: 'test' } as JsonWebKey

    await assert.rejects(
        async () => {
            await fetch('https://api.example.com/data', {
                signingKey: invalidKey,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            })
        },
        /JWK missing required field: kty/,
        'Should reject invalid JWK',
    )

    console.log('✓ Invalid key (missing kty) is rejected')
})

test('Invalid signing key: should throw error for unsupported key type', async () => {
    const invalidKey = { kty: 'UNSUPPORTED' } as JsonWebKey

    await assert.rejects(
        async () => {
            await fetch('https://api.example.com/data', {
                signingKey: invalidKey,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            })
        },
        /Unsupported key type/,
        'Should reject unsupported key type',
    )

    console.log('✓ Unsupported key type is rejected')
})

test('Invalid signing key: should throw error for OKP key missing x', async () => {
    const invalidKey = {
        kty: 'OKP',
        crv: 'Ed25519',
        // missing x
    } as JsonWebKey

    await assert.rejects(
        async () => {
            await fetch('https://api.example.com/data', {
                signingKey: invalidKey,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            })
        },
        /OKP JWK missing required field: x/,
        'Should reject OKP key missing x',
    )

    console.log('✓ OKP key missing x is rejected')
})

test('Invalid signing key: should throw error for EC key missing y', async () => {
    const invalidKey = {
        kty: 'EC',
        crv: 'P-256',
        x: 'test',
        // missing y
    } as JsonWebKey

    await assert.rejects(
        async () => {
            await fetch('https://api.example.com/data', {
                signingKey: invalidKey,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            })
        },
        /EC JWK missing required field: y/,
        'Should reject EC key missing y',
    )

    console.log('✓ EC key missing y is rejected')
})

test('Invalid signing key: should throw error for RSA keys (not supported)', async () => {
    const rsaKey = {
        kty: 'RSA',
        n: 'xGOr_H7A5L9VZhZ8w...',
        e: 'AQAB',
    } as JsonWebKey

    await assert.rejects(
        async () => {
            await fetch('https://api.example.com/data', {
                signingKey: rsaKey,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            })
        },
        /Unsupported key type: RSA/,
        'Should reject RSA keys as unsupported',
    )

    console.log('✓ RSA keys are rejected (not supported)')
})

test('Body handling: undefined body should not add content headers', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(
        headers.get('content-type'),
        null,
        'Should not add content-type for GET',
    )
    assert.strictEqual(
        headers.get('content-digest'),
        null,
        'Should not add content-digest for GET',
    )

    const signatureInput = headers.get('signature-input')
    assert.ok(signatureInput, 'Should have signature-input')
    assert.ok(
        !signatureInput.includes('content-type'),
        'Signature-Input should not include content-type',
    )
    assert.ok(
        !signatureInput.includes('content-digest'),
        'Signature-Input should not include content-digest',
    )

    console.log('✓ GET request does not include content headers')
})

test('Body handling: null body should not add content headers', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: null,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(
        headers.get('content-type'),
        null,
        'Should not add content-type for null body',
    )
    assert.strictEqual(
        headers.get('content-digest'),
        null,
        'Should not add content-digest for null body',
    )

    console.log('✓ null body does not include content headers')
})

test('Body handling: empty string should add content-type', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: '',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(
        headers.get('content-type'),
        'text/plain;charset=UTF-8',
        'Should add content-type for empty string (matching standard fetch)',
    )
    // Note: content-digest is no longer in default components

    console.log('✓ Empty string body includes content-type (text/plain)')
})

test('Signature verification: should fail with tampered Signature-Input', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    // Create a signed request
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: 'test data',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Tamper with the Signature-Input header
    const originalSigInput = headers.get('signature-input')!
    const tamperedSigInput = originalSigInput.replace(
        /created=\d+/,
        'created=0',
    )
    headers.set('signature-input', tamperedSigInput)

    // Try to verify
    const result = await verify({
        method: 'POST',
        path: '/data',
        authority: 'api.example.com',
        headers,
        body: 'test data',
    })

    assert.strictEqual(
        result.verified,
        false,
        'Should fail verification with tampered Signature-Input',
    )
    assert.ok(result.error, 'Should have error message')

    console.log('✓ Tampered Signature-Input is rejected')
    console.log('  Error:', result.error)
})

test('Signature verification: should fail with wrong URL', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    // Sign for one URL
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: 'test data',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Try to verify with different path
    const result = await verify({
        method: 'POST',
        path: '/other', // Wrong path!
        authority: 'api.example.com',
        headers,
        body: 'test data',
    })

    assert.strictEqual(
        result.verified,
        false,
        'Should fail verification with wrong URL',
    )

    console.log('✓ Wrong URL is rejected')
    console.log('  Error:', result.error)
})

test('Signature verification: should fail with wrong method', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    // Sign for POST
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: 'test data',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Try to verify with GET
    const result = await verify({
        method: 'GET', // Wrong method!
        path: '/data',
        authority: 'api.example.com',
        headers,
        body: 'test data',
    })

    assert.strictEqual(
        result.verified,
        false,
        'Should fail verification with wrong method',
    )

    console.log('✓ Wrong method is rejected')
    console.log('  Error:', result.error)
})

test('Body handling: Note that plain JS objects are not supported', async () => {
    // This test documents expected behavior with standard fetch
    // Standard fetch does NOT accept plain objects - they must be serialized

    // Our implementation mirrors standard fetch behavior
    console.log(
        'ℹ  NOTE: Plain JavaScript objects must be serialized before passing to fetch',
    )
    console.log('   Correct:   body: JSON.stringify({ foo: "bar" })')
    console.log('   Incorrect: body: { foo: "bar" }')
    console.log('')
    console.log('   This matches standard fetch() behavior')
})

test('Content-Type: URLSearchParams body', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const params = new URLSearchParams({ foo: 'bar', test: '123' })
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: params,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const contentType = headers.get('content-type')
    assert.strictEqual(
        contentType,
        'application/x-www-form-urlencoded;charset=UTF-8',
        'Should default to application/x-www-form-urlencoded for URLSearchParams',
    )

    console.log('✓ URLSearchParams gets correct content-type')
})

test('Content-Type: Blob body', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const blob = new Blob(['test data'], { type: 'text/plain' })
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: blob,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const contentType = headers.get('content-type')
    assert.strictEqual(
        contentType,
        'text/plain',
        'Should use Blob type as content-type',
    )

    console.log('✓ Blob body uses blob.type as content-type')
})

test('Content-Type: Blob without type', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const blob = new Blob(['test data']) // No type specified
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: blob,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const contentType = headers.get('content-type')
    assert.strictEqual(
        contentType,
        'application/octet-stream',
        'Should default to application/octet-stream for Blob without type',
    )

    console.log('✓ Blob without type gets application/octet-stream')
})

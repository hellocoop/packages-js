/**
 * Test for hwk (Header Web Key) signature type
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

test('hwk: GET request with Ed25519', async () => {
    // Generate key pair
    const { privateJwk } = await generateEd25519KeyPair()

    // Sign a GET request
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Check that headers were generated
    assert.ok(result.headers)
    assert.ok(result.headers.get('signature'))
    assert.ok(result.headers.get('signature-input'))
    assert.ok(result.headers.get('signature-key'))

    console.log('Generated headers:')
    console.log('Signature:', result.headers.get('signature'))
    console.log('Signature-Input:', result.headers.get('signature-input'))
    console.log('Signature-Key:', result.headers.get('signature-key'))

    // Verify the signature
    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    console.log('Verification result:', verifyResult)

    assert.strictEqual(
        verifyResult.verified,
        true,
        'Signature should be verified',
    )
    assert.strictEqual(verifyResult.keyType, 'hwk')
    assert.ok(verifyResult.publicKey)
    assert.strictEqual(verifyResult.publicKey.kty, 'OKP')
    assert.strictEqual(verifyResult.publicKey.crv, 'Ed25519')
})

test('hwk: POST request with body and Ed25519', async () => {
    // Generate key pair
    const { privateJwk } = await generateEd25519KeyPair()

    const body = JSON.stringify({ foo: 'bar', test: 123 })

    // Sign a POST request
    const result = (await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Check that headers were generated
    assert.ok(result.headers)
    assert.ok(result.headers.get('signature'))
    assert.ok(result.headers.get('signature-input'))
    assert.ok(result.headers.get('signature-key'))
    assert.ok(result.headers.get('content-digest'))

    console.log('\nGenerated headers for POST:')
    console.log('Signature:', result.headers.get('signature'))
    console.log('Signature-Input:', result.headers.get('signature-input'))
    console.log('Signature-Key:', result.headers.get('signature-key'))
    console.log('Content-Digest:', result.headers.get('content-digest'))

    // Verify the signature
    const verifyResult = await verify({
        method: 'POST',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
        body,
    })

    console.log('Verification result:', verifyResult)

    assert.strictEqual(
        verifyResult.verified,
        true,
        'Signature should be verified',
    )
    assert.strictEqual(verifyResult.keyType, 'hwk')
})

test('hwk: Signature should fail with modified body', async () => {
    // Generate key pair
    const { privateJwk } = await generateEd25519KeyPair()

    const originalBody = JSON.stringify({ foo: 'bar' })

    // Sign a POST request
    const result = (await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: originalBody,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Try to verify with a different body
    const modifiedBody = JSON.stringify({ foo: 'modified' })

    const verifyResult = await verify({
        method: 'POST',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
        body: modifiedBody,
    })

    console.log('\nVerification result with modified body:', verifyResult)

    assert.strictEqual(
        verifyResult.verified,
        false,
        'Signature should fail with modified body',
    )
})

test('hwk: Signature should fail with expired timestamp', async () => {
    // Generate key pair
    const { privateJwk } = await generateEd25519KeyPair()

    // Sign a request
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    // Manually modify the signature-input to have an old timestamp
    const signatureInput = result.headers.get('signature-input')!
    const oldTimestamp = Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
    const modifiedSignatureInput = signatureInput.replace(
        /created=\d+/,
        `created=${oldTimestamp}`,
    )
    result.headers.set('signature-input', modifiedSignatureInput)

    // Try to verify with the modified timestamp
    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    console.log('\nVerification result with expired timestamp:', verifyResult)

    assert.strictEqual(
        verifyResult.verified,
        false,
        'Signature should fail with expired timestamp',
    )
    assert.ok(verifyResult.error?.includes('timestamp'))
})

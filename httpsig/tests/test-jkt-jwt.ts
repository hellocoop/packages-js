/**
 * Tests for jkt-jwt signature key scheme
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'
import { base64urlEncode, base64urlDecode } from '../src/utils/base64.js'
import { calculateThumbprint } from '../src/utils/thumbprint.js'

/**
 * Generate an Ed25519 key pair as JWK
 */
async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    return { privateJwk, publicJwk }
}

/**
 * Generate an EC P-256 key pair as JWK
 */
async function generateP256KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    return { privateJwk, publicJwk }
}

/**
 * Create a properly signed jkt-jwt JWT.
 * The identity key signs the JWT, delegating to the ephemeral key via cnf.jwk.
 */
async function createJktJwt(options: {
    identityPrivateJwk: JsonWebKey
    identityPublicJwk: JsonWebKey
    ephemeralPublicJwk: JsonWebKey
    typ?: string
    hashAlgorithm?: 'SHA-256' | 'SHA-512'
    issPrefix?: string
    iatOffset?: number // seconds offset from now
    expOffset?: number // seconds offset from now
    overrideIss?: string // override the iss claim
    omitCnf?: boolean
}): Promise<string> {
    const {
        identityPrivateJwk,
        identityPublicJwk,
        ephemeralPublicJwk,
        typ = 'jkt-s256+jwt',
        hashAlgorithm = 'SHA-256',
        issPrefix = 'urn:jkt:sha-256:',
        iatOffset = 0,
        expOffset = 3600,
        overrideIss,
        omitCnf = false,
    } = options

    // Determine alg from identity key
    let alg: string
    if (identityPublicJwk.kty === 'OKP' && identityPublicJwk.crv === 'Ed25519') {
        alg = 'EdDSA'
    } else if (identityPublicJwk.kty === 'EC' && identityPublicJwk.crv === 'P-256') {
        alg = 'ES256'
    } else {
        throw new Error('Unsupported identity key type')
    }

    // Strip private key fields from the identity public JWK
    const { d, p, q, dp, dq, qi, ...cleanPublicJwk } = identityPublicJwk as any

    const header: any = {
        typ,
        alg,
        jwk: cleanPublicJwk,
    }

    const now = Math.floor(Date.now() / 1000)
    const thumbprint = await calculateThumbprint(cleanPublicJwk, hashAlgorithm)
    const iss = overrideIss ?? `${issPrefix}${thumbprint}`

    const payload: any = {
        iss,
        iat: now + iatOffset,
        exp: now + expOffset,
    }

    if (!omitCnf) {
        payload.cnf = { jwk: ephemeralPublicJwk }
    }

    const encodedHeader = base64urlEncode(JSON.stringify(header))
    const encodedPayload = base64urlEncode(JSON.stringify(payload))
    const signingInput = `${encodedHeader}.${encodedPayload}`

    // Sign with the identity key
    const algorithm =
        alg === 'EdDSA'
            ? { name: 'Ed25519' }
            : { name: 'ECDSA', hash: 'SHA-256' }

    const identityKey = await crypto.subtle.importKey(
        'jwk',
        identityPrivateJwk,
        alg === 'EdDSA' ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
    )

    const signatureBytes = await crypto.subtle.sign(
        algorithm,
        identityKey,
        new TextEncoder().encode(signingInput),
    )

    const encodedSignature = base64urlEncode(new Uint8Array(signatureBytes))

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

// --- Tests ---

test('jkt-jwt: GET request with Ed25519 identity and Ed25519 ephemeral key', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(result.headers.get('signature'))
    assert.ok(result.headers.get('signature-input'))
    assert.ok(result.headers.get('signature-key'))

    // Signature-Key should use jkt-jwt scheme
    const sigKeyHeader = result.headers.get('signature-key')!
    assert.ok(sigKeyHeader.startsWith('sig=jkt-jwt;'), `Expected jkt-jwt scheme, got: ${sigKeyHeader}`)

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)
    assert.strictEqual(verifyResult.keyType, 'jkt_jwt')
    assert.ok(verifyResult.jkt_jwt, 'Should have jkt_jwt data')
    assert.strictEqual(verifyResult.jkt_jwt?.raw, jwt)
    assert.ok(verifyResult.jkt_jwt?.identityKey, 'Should have identity key')
    assert.strictEqual(verifyResult.jkt_jwt?.identityKey.kty, 'OKP')
    assert.ok(
        verifyResult.jkt_jwt?.identityThumbprint.startsWith('urn:jkt:sha-256:'),
        'Identity thumbprint should be a urn:jkt URI',
    )
    // The ephemeral key should be the publicKey used for HTTP sig verification
    assert.strictEqual(verifyResult.publicKey.kty, 'OKP')
    assert.strictEqual(verifyResult.publicKey.x, ephemeral.publicJwk.x)
})

test('jkt-jwt: POST request with body', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const body = JSON.stringify({ action: 'create', data: { name: 'test' } })

    const result = (await fetch('https://api.example.com/resource', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'POST',
        path: '/resource',
        authority: 'api.example.com',
        headers: result.headers,
        body,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)
    assert.strictEqual(verifyResult.keyType, 'jkt_jwt')
})

test('jkt-jwt: P-256 identity key delegating to Ed25519 ephemeral key', async () => {
    const identity = await generateP256KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)
    assert.strictEqual(verifyResult.keyType, 'jkt_jwt')
    assert.strictEqual(verifyResult.jkt_jwt?.identityKey.kty, 'EC')
    assert.strictEqual(verifyResult.jkt_jwt?.identityKey.crv, 'P-256')
    assert.strictEqual(verifyResult.publicKey.kty, 'OKP')
})

test('jkt-jwt: Ed25519 identity key delegating to P-256 ephemeral key', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateP256KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)
    assert.strictEqual(verifyResult.jkt_jwt?.identityKey.kty, 'OKP')
    assert.strictEqual(verifyResult.publicKey.kty, 'EC')
    assert.strictEqual(verifyResult.publicKey.crv, 'P-256')
})

test('jkt-jwt: Should fail with expired JWT', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
        iatOffset: -7200, // 2 hours ago
        expOffset: -3600, // expired 1 hour ago
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(verifyResult.error?.includes('expired'), `Expected expired error, got: ${verifyResult.error}`)
})

test('jkt-jwt: Should fail with future iat', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
        iatOffset: 3600, // 1 hour in the future
        expOffset: 7200,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(verifyResult.error?.includes('future'), `Expected future error, got: ${verifyResult.error}`)
})

test('jkt-jwt: Should fail with tampered iss (wrong thumbprint)', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
        overrideIss: 'urn:jkt:sha-256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(verifyResult.error?.includes('iss mismatch'), `Expected iss mismatch, got: ${verifyResult.error}`)
})

test('jkt-jwt: Should fail with tampered JWT signature', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    // Tamper with the JWT signature (last segment)
    const parts = jwt.split('.')
    const tamperedSig = base64urlEncode('tampered-signature-bytes-here-pad')
    const tamperedJwt = `${parts[0]}.${parts[1]}.${tamperedSig}`

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt: tamperedJwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(
        verifyResult.error?.includes('JWT signature verification failed'),
        `Expected JWT signature failure, got: ${verifyResult.error}`,
    )
})

test('jkt-jwt: Should fail with missing cnf.jwk in JWT', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
        omitCnf: true,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(verifyResult.error?.includes('cnf.jwk'), `Expected cnf.jwk error, got: ${verifyResult.error}`)
})

test('jkt-jwt: Should fail with unsupported typ', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    // Create JWT with unsupported typ
    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
        typ: 'jkt-s384+jwt', // not supported
        hashAlgorithm: 'SHA-256', // doesn't matter, will fail on typ check
        issPrefix: 'urn:jkt:sha-384:',
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(
        verifyResult.error?.includes('Unsupported jkt-jwt typ'),
        `Expected unsupported typ error, got: ${verifyResult.error}`,
    )
})

test('jkt-jwt: Should fail if HTTP signature uses wrong ephemeral key', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()
    const wrongKey = await generateEd25519KeyPair()

    // JWT delegates to ephemeral key, but we sign HTTP request with wrongKey
    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: wrongKey.privateJwk, // sign with wrong key
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    // JWT validation should pass, but HTTP signature verification should fail
    // because the signature was made with wrongKey, not the ephemeral key in cnf.jwk
    assert.strictEqual(verifyResult.verified, false)
})

test('jkt-jwt: Custom label should work', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        label: 'device',
        dryRun: true,
    })) as { headers: Headers }

    const sigKeyHeader = result.headers.get('signature-key')!
    assert.ok(sigKeyHeader.startsWith('device=jkt-jwt;'))

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)
    assert.strictEqual(verifyResult.label, 'device')
    assert.strictEqual(verifyResult.keyType, 'jkt_jwt')
})

test('jkt-jwt: Thumbprint in result should be for the ephemeral key', async () => {
    const identity = await generateEd25519KeyPair()
    const ephemeral = await generateEd25519KeyPair()

    const jwt = await createJktJwt({
        identityPrivateJwk: identity.privateJwk,
        identityPublicJwk: identity.publicJwk,
        ephemeralPublicJwk: ephemeral.publicJwk,
    })

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: ephemeral.privateJwk,
        signatureKey: { type: 'jkt_jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    assert.strictEqual(verifyResult.verified, true, `Verification failed: ${verifyResult.error}`)

    // The top-level thumbprint should be for the ephemeral key (the key that signed the HTTP message)
    const expectedEphemeralThumbprint = await calculateThumbprint(ephemeral.publicJwk)
    assert.strictEqual(verifyResult.thumbprint, expectedEphemeralThumbprint)

    // The identity thumbprint should be different (for the enclave key)
    const expectedIdentityThumbprint = await calculateThumbprint(identity.publicJwk)
    assert.ok(
        verifyResult.jkt_jwt?.identityThumbprint.endsWith(expectedIdentityThumbprint),
        'Identity thumbprint URI should contain the identity key thumbprint',
    )
})

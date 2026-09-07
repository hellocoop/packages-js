/**
 * Test for jwt signature type
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'
import { base64urlEncode } from '../src/utils/base64.js'

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

    // alg is REQUIRED on a JWK; WebCrypto does not set it.
    privateJwk.alg = 'Ed25519'
    publicJwk.alg = 'Ed25519'

    return { privateJwk, publicJwk }
}

/**
 * Create a simple JWT with cnf.jwk claim (NOT cryptographically signed - for testing only)
 * In production, the JWT would be properly signed by an issuer
 */
function createMockJWT(publicJwk: JsonWebKey): string {
    const header = {
        alg: 'EdDSA',
        typ: 'agent+jwt',
        kid: 'test-key-1',
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: 'https://issuer.example',
        sub: 'agent-instance-123',
        iat: now,
        exp: now + 3600,
        cnf: {
            jwk: publicJwk,
        },
    }

    // Encode header and payload
    const encodedHeader = base64urlEncode(JSON.stringify(header))
    const encodedPayload = base64urlEncode(JSON.stringify(payload))

    // For testing, we'll use a fake signature (normally this would be signed by the issuer)
    const fakeSignature = base64urlEncode('fake-signature-for-testing')

    return `${encodedHeader}.${encodedPayload}.${fakeSignature}`
}

test('jwt: GET request with JWT containing cnf.jwk', async () => {
    // Generate key pair for signing the HTTP message
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Create a JWT with the public key in cnf.jwk claim
    const jwt = createMockJWT(publicJwk)

    console.log('Created JWT:', jwt)

    // Sign a GET request using the JWT
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    // Check that headers were generated
    assert.ok(result.headers)
    assert.ok(result.headers.get('signature'))
    assert.ok(result.headers.get('signature-input'))
    assert.ok(result.headers.get('signature-key'))

    console.log('\nGenerated headers:')
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

    console.log('\nVerification result:', verifyResult)

    assert.strictEqual(
        verifyResult.verified,
        true,
        'Signature should be verified',
    )
    assert.strictEqual(verifyResult.keyType, 'jwt')
    assert.ok(verifyResult.jwt, 'Should have JWT data')
    assert.strictEqual(verifyResult.jwt?.raw, jwt, 'Should return raw JWT')
    assert.ok(verifyResult.jwt?.header, 'Should have JWT header')
    assert.ok(verifyResult.jwt?.payload, 'Should have JWT payload')
    assert.strictEqual(
        (verifyResult.jwt?.payload as any).iss,
        'https://issuer.example',
    )
    assert.strictEqual(verifyResult.publicKey.kty, 'OKP')
    assert.strictEqual(verifyResult.publicKey.crv, 'Ed25519')
})

test('jwt: POST request with body and JWT', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Create JWT
    const jwt = createMockJWT(publicJwk)

    const body = JSON.stringify({ action: 'create', data: { name: 'test' } })

    // Sign a POST request
    const result = (await fetch('https://api.example.com/resource', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    // Check headers
    assert.ok(result.headers.get('signature'))
    assert.ok(result.headers.get('signature-input'))
    assert.ok(result.headers.get('signature-key'))

    console.log('\nGenerated headers for POST:')
    console.log('Signature:', result.headers.get('signature'))
    console.log('Signature-Input:', result.headers.get('signature-input'))

    // Verify
    const verifyResult = await verify({
        method: 'POST',
        path: '/resource',
        authority: 'api.example.com',
        headers: result.headers,
        body,
    })

    console.log('\nVerification result:', verifyResult)

    assert.strictEqual(verifyResult.verified, true)
    assert.strictEqual(verifyResult.keyType, 'jwt')
    assert.strictEqual(verifyResult.jwt?.raw, jwt)
})

test('jwt: Should fail verification if JWT missing cnf.jwk claim', async () => {
    // Generate key pair
    const { privateJwk } = await generateEd25519KeyPair()

    // Create a JWT WITHOUT cnf.jwk claim
    const header = {
        alg: 'EdDSA',
        typ: 'agent+jwt',
    }

    const payload = {
        iss: 'https://issuer.example',
        sub: 'test',
        exp: Math.floor(Date.now() / 1000) + 3600,
        // Missing cnf.jwk!
    }

    const encodedHeader = base64urlEncode(JSON.stringify(header))
    const encodedPayload = base64urlEncode(JSON.stringify(payload))
    const fakeSignature = base64urlEncode('fake-signature')
    const badJwt = `${encodedHeader}.${encodedPayload}.${fakeSignature}`

    // Try to sign a request (this should work - validation happens on verify)
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'jwt', jwt: badJwt },
        dryRun: true,
    })) as { headers: Headers }

    // Verification should fail because JWT lacks cnf.jwk
    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    console.log('\nVerification result with missing cnf.jwk:', verifyResult)

    assert.strictEqual(verifyResult.verified, false)
    assert.ok(verifyResult.error?.includes('cnf.jwk'))
})

test('jwt: Custom label should work', async () => {
    // Generate key pair
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // Create JWT
    const jwt = createMockJWT(publicJwk)

    // Sign with custom label
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'jwt', jwt },
        label: 'custom',
        dryRun: true,
    })) as { headers: Headers }

    console.log(
        '\nSignature-Input with custom label:',
        result.headers.get('signature-input'),
    )
    console.log(
        'Signature-Key with custom label:',
        result.headers.get('signature-key'),
    )

    // Verify with custom label
    const verifyResult = await verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: result.headers,
    })

    console.log('\nVerification result with custom label:', verifyResult)

    assert.strictEqual(verifyResult.verified, true)
    assert.strictEqual(verifyResult.label, 'custom')
    assert.strictEqual(verifyResult.keyType, 'jwt')
})

/**
 * Regression tests for the jwt scheme's claim handling.
 *
 * The jwt scheme's assertion is signed by an issuer whose keys are at
 * `{iss}/.well-known/{dwk}`. This library does not resolve that, so it cannot
 * authenticate the payload — it only reads `cnf.jwk` out of it to verify the
 * HTTP signature. Judging `exp` here therefore judged bytes the presenter
 * chose, and reported `expired_jwt`, a code whose registry meaning is that
 * the named issuer minted the assertion and its lifetime ran out.
 *
 * The consequence was that any forgery could be made to report `expired_jwt`
 * by writing a past `exp` into it, so a caller could not tell "refresh your
 * token" from "this was not issued by anyone". Expiry is now the caller's
 * judgement, made after it verifies the issuer's signature.
 */

function createMockJWTWithClaims(
    publicJwk: JsonWebKey,
    claims: Record<string, unknown>,
): string {
    const header = { alg: 'EdDSA', typ: 'agent+jwt', kid: 'test-key-1' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: 'https://issuer.example',
        sub: 'agent-instance-123',
        iat: now,
        exp: now + 3600,
        cnf: { jwk: publicJwk },
        ...claims,
    }
    return [
        base64urlEncode(JSON.stringify(header)),
        base64urlEncode(JSON.stringify(payload)),
        base64urlEncode('fake-signature-for-testing'),
    ].join('.')
}

async function verifySignedWith(jwt: string, privateJwk: JsonWebKey) {
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'jwt', jwt },
        dryRun: true,
    })) as { headers: Headers }

    return verify({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers,
    })
}

test('jwt: a past exp is not judged here, and never reports expired_jwt', async () => {
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const now = Math.floor(Date.now() / 1000)

    // Two hours stale — well past any clock skew tolerance.
    const jwt = createMockJWTWithClaims(publicJwk, {
        iat: now - 7200,
        exp: now - 7200,
    })

    const result = await verifySignedWith(jwt, privateJwk)

    assert.strictEqual(
        result.signatureError?.error,
        undefined,
        'expiry of an unauthenticated payload is not this layer’s call',
    )
    assert.strictEqual(
        result.verified,
        true,
        'the HTTP signature verifies against cnf.jwk regardless of exp',
    )
    assert.strictEqual(
        (result.jwt?.payload as any).exp,
        now - 7200,
        'the caller gets exp back and judges it after verifying the issuer',
    )
})

test('jwt: a future iat is not judged here either', async () => {
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const now = Math.floor(Date.now() / 1000)

    const jwt = createMockJWTWithClaims(publicJwk, {
        iat: now + 7200,
        exp: now + 10800,
    })

    const result = await verifySignedWith(jwt, privateJwk)

    assert.strictEqual(result.signatureError?.error, undefined)
    assert.strictEqual(result.verified, true)
})

test('jwt: a missing exp is still invalid_jwt', async () => {
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()

    // An assertion that never expires is malformed, and saying so needs no
    // authentication — it is a structural judgement, not a temporal one.
    const jwt = createMockJWTWithClaims(publicJwk, { exp: undefined })

    const result = await verifySignedWith(jwt, privateJwk)

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.signatureError?.error, 'invalid_jwt')
})

test('jwt: a missing cnf.jwk is still invalid_jwt', async () => {
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const jwt = createMockJWTWithClaims(publicJwk, { cnf: undefined })

    const result = await verifySignedWith(jwt, privateJwk)

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.signatureError?.error, 'invalid_jwt')
})

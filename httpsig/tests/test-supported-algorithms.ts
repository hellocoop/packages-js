/**
 * supportedAlgorithms, and tolerance of unusable keys in a JWKS
 *
 * A verifier rejects a key whose `alg` falls outside the set it accepts, and
 * reports that set so the caller can send it in Accept-Signature-Alg. It does
 * NOT go in Signature-Error -- the supported_algorithms member was removed
 * in -08.
 *
 * Separately, a verifier resolving a key from a JWKS must select the member
 * matching `kid` without requiring any other member to be usable. Without
 * that, an issuer could never add a post-quantum key alongside a classical
 * one: doing so would break every verifier that does not implement the new
 * key type, including verifiers that were only going to use the classical key.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'
import { SUPPORTED_ALGORITHMS } from '../src/utils/crypto.js'

async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    privateJwk.alg = 'Ed25519'
    publicJwk.alg = 'Ed25519'

    return { privateJwk, publicJwk }
}

/** Sign a request with hwk and return it in verify()'s request shape. */
async function signedRequest(privateJwk: JsonWebKey) {
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const headers: Record<string, string> = {}
    result.headers.forEach((v, k) => {
        headers[k] = v
    })

    return {
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers,
    }
}

test('supportedAlgorithms: defaults to everything the library implements', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request)

    assert.strictEqual(result.verified, true, result.error)
    assert.ok(SUPPORTED_ALGORITHMS.includes('Ed25519'))
})

test('supportedAlgorithms: accepts a key inside the configured set', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request, {
        supportedAlgorithms: ['Ed25519', 'ES256'],
    })

    assert.strictEqual(result.verified, true, result.error)
})

test('supportedAlgorithms: rejects a key outside the configured set', async () => {
    // The key is a perfectly good Ed25519 key. This verifier declines Ed25519
    // by policy, which is a different thing from not implementing it.
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request, { supportedAlgorithms: ['ES256'] })

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.signatureError?.error, 'unsupported_algorithm')
})

test('supportedAlgorithms: reports the accepted set for Accept-Signature-Alg', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request, {
        supportedAlgorithms: ['ES256', 'ES384'],
    })

    assert.deepStrictEqual(result.acceptSignatureAlg, ['ES256', 'ES384'])
})

test('supportedAlgorithms: the accepted set is not a Signature-Error member', async () => {
    // -08 removed supported_algorithms from Signature-Error. What the verifier
    // accepts travels in Accept-Signature-Alg instead.
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request, { supportedAlgorithms: ['ES256'] })

    assert.ok(
        !('supported_algorithms' in (result.signatureError ?? {})),
        'Signature-Error must not carry supported_algorithms',
    )
})

test('supportedAlgorithms: an empty set accepts nothing', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const request = await signedRequest(privateJwk)

    const result = await verify(request, { supportedAlgorithms: [] })

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.signatureError?.error, 'unsupported_algorithm')
})

/**
 * Mock a JWKS containing a key this implementation cannot parse alongside one
 * it can, and select the usable one by kid.
 */
function setupMixedJwks(
    usableKey: JsonWebKey,
    order: 'first' | 'last',
    issuer: string,
) {
    const originalFetch = globalThis.fetch

    // An ML-DSA key. kty "AKP" (RFC 9964) is not implemented here, and the
    // value is not even well formed -- the point is that it is never touched.
    const mlDsaKey = {
        kty: 'AKP',
        alg: 'ML-DSA-44',
        pub: 'not-real-key-material',
        kid: 'pq-key',
        use: 'sig',
    }
    const ed = { ...usableKey, kid: 'classical-key', use: 'sig' }

    const keys = order === 'first' ? [mlDsaKey, ed] : [ed, mlDsaKey]

    globalThis.fetch = (async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString()
        if (u === `${issuer}/.well-known/test-metadata`) {
            return new Response(
                JSON.stringify({
                    issuer,
                    jwks_uri: `${issuer}/jwks.json`,
                }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            )
        }
        if (u === `${issuer}/jwks.json`) {
            return new Response(JSON.stringify({ keys }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }
        return new Response('not found', { status: 404 })
    }) as typeof globalThis.fetch

    return () => {
        globalThis.fetch = originalFetch
    }
}

for (const order of ['first', 'last'] as const) {
    test(`JWKS: an unimplemented key type listed ${order} does not prevent selecting a usable key`, async () => {
        const { privateJwk, publicJwk } = await generateEd25519KeyPair()
        const issuer = `https://issuer-${order}.example`
        const restore = setupMixedJwks(publicJwk, order, issuer)

        try {
            const signed = (await fetch('https://api.example.com/data', {
                method: 'GET',
                signingKey: privateJwk,
                signatureKey: {
                    type: 'jwks_uri',
                    id: issuer,
                    kid: 'classical-key',
                    dwk: 'test-metadata',
                },
                dryRun: true,
            })) as { headers: Headers }

            const headers: Record<string, string> = {}
            signed.headers.forEach((v, k) => {
                headers[k] = v
            })

            const result = await verify({
                method: 'GET',
                authority: 'api.example.com',
                path: '/data',
                headers,
            })

            assert.strictEqual(
                result.verified,
                true,
                `An ML-DSA key elsewhere in the JWKS must not prevent verification: ${result.error}`,
            )
            assert.strictEqual(result.publicKey.alg, 'Ed25519')
        } finally {
            restore()
        }
    })
}

test('JWKS: selecting the unimplemented key itself is declined, not a crash', async () => {
    // The complement of the rule above: when the kid does select the key this
    // implementation cannot use, it declines cleanly.
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const issuer = 'https://issuer-decline.example'
    const restore = setupMixedJwks(publicJwk, 'first', issuer)

    try {
        const signed = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: {
                type: 'jwks_uri',
                id: issuer,
                kid: 'pq-key',
                dwk: 'test-metadata',
            },
            dryRun: true,
        })) as { headers: Headers }

        const headers: Record<string, string> = {}
        signed.headers.forEach((v, k) => {
            headers[k] = v
        })

        const result = await verify({
            method: 'GET',
            authority: 'api.example.com',
            path: '/data',
            headers,
        })

        assert.strictEqual(result.verified, false)
        assert.strictEqual(
            result.signatureError?.error,
            'unsupported_algorithm',
            'Absence of support is a reason to decline, not a parsing failure',
        )
    } finally {
        restore()
    }
})

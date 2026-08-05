/**
 * Discovery metadata must be bound to the identity it was fetched under
 *
 * The metadata document at `{id}/.well-known/{dwk}` MUST carry an `issuer`
 * member equal to `id`. Without that check a document served under one
 * identity -- misconfigured shared hosting, a subdomain takeover -- could
 * point `jwks_uri` at keys belonging to someone else, and the verifier would
 * attribute the request to the identity in the header.
 *
 * Same check RFC 8414 Section 3.3 requires of authorization server metadata.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'

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

/**
 * Serve metadata and a JWKS for `id`. `issuer` is what the metadata document
 * claims, which the tests vary independently of the identity it is served
 * under. Each test uses its own origin: the JWKS cache is module-level and
 * keyed by URL.
 */
function setupDiscovery(
    id: string,
    publicJwk: JsonWebKey,
    issuer: string | undefined,
) {
    const originalFetch = globalThis.fetch

    const metadata: Record<string, string> = {
        jwks_uri: `${id}/jwks.json`,
    }
    if (issuer !== undefined) {
        metadata.issuer = issuer
    }

    globalThis.fetch = (async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString()
        if (u === `${id}/.well-known/test-metadata`) {
            return new Response(JSON.stringify(metadata), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }
        if (u === `${id}/jwks.json`) {
            return new Response(
                JSON.stringify({
                    keys: [{ ...publicJwk, kid: 'key-1', use: 'sig' }],
                }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            )
        }
        return new Response('not found', { status: 404 })
    }) as typeof globalThis.fetch

    return () => {
        globalThis.fetch = originalFetch
    }
}

async function signAndVerify(privateJwk: JsonWebKey, id: string) {
    const signed = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: {
            type: 'jwks_uri',
            id,
            kid: 'key-1',
            dwk: 'test-metadata',
        },
        dryRun: true,
    })) as { headers: Headers }

    const headers: Record<string, string> = {}
    signed.headers.forEach((v, k) => {
        headers[k] = v
    })

    return verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers,
    })
}

test('discovery: metadata whose issuer matches id verifies', async () => {
    const id = 'https://issuer-ok.example'
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const restore = setupDiscovery(id, publicJwk, id)

    try {
        const result = await signAndVerify(privateJwk, id)
        assert.strictEqual(result.verified, true, result.error)
    } finally {
        restore()
    }
})

test('discovery: metadata with no issuer is rejected as issuer_missing', async () => {
    const id = 'https://issuer-absent.example'
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const restore = setupDiscovery(id, publicJwk, undefined)

    try {
        const result = await signAndVerify(privateJwk, id)

        assert.strictEqual(result.verified, false)
        assert.strictEqual(result.signatureError?.error, 'issuer_missing')
    } finally {
        restore()
    }
})

test('discovery: metadata claiming a different issuer is rejected as issuer_mismatch', async () => {
    // The attack this prevents: a document served at attacker.example claiming
    // to be victim.example, pointing jwks_uri at the attacker's keys.
    const id = 'https://issuer-wrong.example'
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const restore = setupDiscovery(
        id,
        publicJwk,
        'https://someone-else.example',
    )

    try {
        const result = await signAndVerify(privateJwk, id)

        assert.strictEqual(result.verified, false)
        assert.strictEqual(result.signatureError?.error, 'issuer_mismatch')
    } finally {
        restore()
    }
})

test('discovery: issuer comparison is byte equality, not normalized', async () => {
    // A trailing slash is a different identifier. The draft specifies byte
    // equality as presented, so no normalization is applied.
    const id = 'https://issuer-slash.example'
    const { privateJwk, publicJwk } = await generateEd25519KeyPair()
    const restore = setupDiscovery(id, publicJwk, `${id}/`)

    try {
        const result = await signAndVerify(privateJwk, id)

        assert.strictEqual(result.verified, false)
        assert.strictEqual(result.signatureError?.error, 'issuer_mismatch')
    } finally {
        restore()
    }
})

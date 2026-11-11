/**
 * Tests for the key resolver: store, fetch policy, and the onFetch hook.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import {
    createKeyResolver,
    fetch as signedFetch,
    verify,
    SignatureVerificationError,
} from '../src/index.js'
import type { KeyFetchEvent, KeyStore, KeyStoreEntry } from '../src/index.js'

const ID = 'https://signer.example'
const DWK = 'example-configuration'
const METADATA_URL = `${ID}/.well-known/${DWK}`
const JWKS_URL = `${ID}/jwks.json`

async function generateKey(kid: string) {
    const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
        'sign',
        'verify',
    ])) as CryptoKeyPair
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    privateJwk.alg = 'Ed25519'
    publicJwk.alg = 'Ed25519'
    return { privateJwk, publicJwk: { ...publicJwk, kid } as JsonWebKey }
}

interface Origin {
    metadata: unknown
    jwks: unknown
    metadataHeaders?: Record<string, string>
    jwksHeaders?: Record<string, string>
    metadataStatus?: number
    jwksStatus?: number
}

/** A fetch serving one signer's two documents, recording what was asked. */
function origin(state: Origin) {
    const calls: string[] = []
    const inits: (RequestInit | undefined)[] = []
    const fetch = async (url: string, init?: RequestInit) => {
        calls.push(url)
        inits.push(init)
        if (url === METADATA_URL) {
            return new Response(JSON.stringify(state.metadata), {
                status: state.metadataStatus ?? 200,
                headers: state.metadataHeaders,
            })
        }
        if (url === JWKS_URL) {
            return new Response(JSON.stringify(state.jwks), {
                status: state.jwksStatus ?? 200,
                headers: state.jwksHeaders,
            })
        }
        return new Response('not found', { status: 404 })
    }
    return { fetch, calls, inits, state }
}

const metadata = { issuer: ID, jwks_uri: JWKS_URL }

/** A store whose entries the test can read and rewrite. */
function mapStore() {
    const entries = new Map<string, KeyStoreEntry>()
    const store: KeyStore = {
        get: async (url) => entries.get(url),
        set: async (url, entry) => {
            entries.set(url, entry)
        },
    }
    return { store, entries }
}

test('resolves a key and serves the next lookup from the store', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        onFetch: (e) => events.push(e),
    })

    const key = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.deepStrictEqual(key, publicJwk)
    assert.deepStrictEqual(o.calls, [METADATA_URL, JWKS_URL])

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.strictEqual(o.calls.length, 2, 'second lookup must not fetch')

    assert.deepStrictEqual(
        events.map((e) => [e.doc, e.reason, e.ok, e.status]),
        [
            ['metadata', 'cold', true, 200],
            ['jwks', 'cold', true, 200],
        ],
    )
    assert.strictEqual(events[0].id, ID)
    assert.strictEqual(events[0].dwk, DWK)
    assert.strictEqual(events[0].kid, 'key-1')
    assert.strictEqual(events[0].ttl_ms, 3_600_000)
    assert.ok(events[0].duration_ms >= 0)
})

test('fetches with redirect refused and an abort signal', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.strictEqual(o.inits[0]?.redirect, 'error')
    assert.ok(o.inits[0]?.signal instanceof AbortSignal)
})

test('unknown kid: refetches once and finds a rotated key', async () => {
    const first = await generateKey('key-1')
    const second = await generateKey('key-2')
    const o = origin({ metadata, jwks: { keys: [first.publicJwk] } })
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        minRefetchIntervalMs: 0,
        onFetch: (e) => events.push(e),
    })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    o.state.jwks = { keys: [first.publicJwk, second.publicJwk] }

    const key = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-2' })
    assert.deepStrictEqual(key, second.publicJwk)
    assert.deepStrictEqual(
        events.slice(2).map((e) => [e.doc, e.reason]),
        [
            ['metadata', 'unknown_kid'],
            ['jwks', 'unknown_kid'],
        ],
    )
})

test('unknown kid: reports unknown_key when the refetch does not have it', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const resolver = createKeyResolver({
        fetch: o.fetch,
        minRefetchIntervalMs: 0,
    })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'absent' }),
        (error: unknown) =>
            error instanceof SignatureVerificationError &&
            error.code === 'unknown_key',
    )
    // One cold pass, one refresh pass.
    assert.strictEqual(o.calls.length, 4)
})

test('refetch floor: an unknown kid inside the floor does not fetch again', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    for (let i = 0; i < 5; i++) {
        await assert.rejects(
            resolver.resolveKey({ id: ID, dwk: DWK, kid: `bogus-${i}` }),
        )
    }
    assert.strictEqual(o.calls.length, 2, 'the floor must hold')
})

test('refetch floor: a failed fetch is not retried inside the floor', async () => {
    const o = origin({ metadata, jwks: { keys: [] }, metadataStatus: 503 })
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        onFetch: (e) => events.push(e),
    })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /Failed to fetch/,
    )
    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /Failed to fetch/,
    )
    assert.strictEqual(o.calls.length, 1)
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].ok, false)
    assert.strictEqual(events[0].status, 503)
})

test('a failed fetch is retried once the floor has passed', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({
        metadata,
        jwks: { keys: [publicJwk] },
        metadataStatus: 503,
    })
    const resolver = createKeyResolver({
        fetch: o.fetch,
        minRefetchIntervalMs: 0,
    })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
    )
    o.state.metadataStatus = 200
    const key = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.deepStrictEqual(key, publicJwk)
})

test('Cache-Control max-age is honored down to the floor and capped', async () => {
    const { publicJwk } = await generateKey('key-1')
    const cases: [string | undefined, number][] = [
        [undefined, 3_600_000],
        ['max-age=120', 120_000],
        ['public, max-age=600', 600_000],
        ['max-age=31536000', 3_600_000],
        ['max-age=5', 60_000],
        ['max-age=0', 60_000],
        ['no-store', 60_000],
    ]
    for (const [header, expected] of cases) {
        const o = origin({
            metadata,
            jwks: { keys: [publicJwk] },
            metadataHeaders: header ? { 'cache-control': header } : undefined,
        })
        const events: KeyFetchEvent[] = []
        const resolver = createKeyResolver({
            fetch: o.fetch,
            onFetch: (e) => events.push(e),
        })
        await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
        assert.strictEqual(
            events[0].ttl_ms,
            expected,
            `Cache-Control: ${header}`,
        )
    }
})

test('an expired document is fetched again', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const { store, entries } = mapStore()
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        store,
        onFetch: (e) => events.push(e),
    })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    for (const entry of entries.values()) {
        entry.freshUntil = Date.now() - 1
        entry.attemptedAt = Date.now() - 120_000
    }
    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })

    assert.strictEqual(o.calls.length, 4)
    assert.deepStrictEqual(
        events.slice(2).map((e) => e.reason),
        ['expired', 'expired'],
    )
})

test('staleIfErrorMs: an expired document is used when the refetch fails', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const { store, entries } = mapStore()
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        store,
        staleIfErrorMs: 600_000,
        onFetch: (e) => events.push(e),
    })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    for (const entry of entries.values()) {
        entry.freshUntil = Date.now() - 1
        entry.attemptedAt = Date.now() - 120_000
    }
    o.state.metadataStatus = 503
    o.state.jwksStatus = 503

    const key = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.deepStrictEqual(key, publicJwk)
    assert.deepStrictEqual(
        events.slice(2).map((e) => [e.ok, e.served_stale]),
        [
            [false, true],
            [false, true],
        ],
    )

    // The failed attempt holds the floor: no third round of fetches.
    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.strictEqual(o.calls.length, 4)
})

test('without staleIfErrorMs an expired document is not used', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const { store, entries } = mapStore()
    const resolver = createKeyResolver({ fetch: o.fetch, store })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    for (const entry of entries.values()) {
        entry.freshUntil = Date.now() - 1
        entry.attemptedAt = Date.now() - 120_000
    }
    o.state.metadataStatus = 503

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /Failed to fetch/,
    )
})

test('staleWhileRevalidateMs: returns the expired document and refetches behind it', async () => {
    const first = await generateKey('key-1')
    const second = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [first.publicJwk] } })
    const { store, entries } = mapStore()
    const background: Promise<unknown>[] = []
    const resolver = createKeyResolver({
        fetch: o.fetch,
        store,
        staleWhileRevalidateMs: 600_000,
        waitUntil: (work) => background.push(work),
    })

    await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    for (const entry of entries.values()) {
        entry.freshUntil = Date.now() - 1
        entry.attemptedAt = Date.now() - 120_000
    }
    o.state.jwks = { keys: [second.publicJwk] }

    const served = await resolver.resolveKey({
        id: ID,
        dwk: DWK,
        kid: 'key-1',
    })
    assert.deepStrictEqual(served, first.publicJwk)
    assert.strictEqual(background.length, 2)

    await Promise.all(background)
    const next = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.deepStrictEqual(next, second.publicJwk)
})

test('timeout: a fetch that does not answer is abandoned', async () => {
    const events: KeyFetchEvent[] = []
    const resolver = createKeyResolver({
        timeoutMs: 20,
        fetch: (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(init.signal?.reason),
                )
            }),
        onFetch: (e) => events.push(e),
    })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /Timed out fetching/,
    )
    assert.strictEqual(events[0].error, 'timeout')
    assert.strictEqual(events[0].ok, false)
})

test('refuses a URL that is not https', async () => {
    const o = origin({ metadata, jwks: { keys: [] } })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await assert.rejects(
        resolver.resolveKey({
            id: 'http://signer.example',
            dwk: DWK,
            kid: 'key-1',
        }),
        /HTTPS is required/,
    )
    assert.strictEqual(o.calls.length, 0)
})

test('refuses a jwks_uri that is not https', async () => {
    const o = origin({
        metadata: { issuer: ID, jwks_uri: 'http://169.254.169.254/keys' },
        jwks: { keys: [] },
    })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /HTTPS is required/,
    )
    assert.deepStrictEqual(o.calls, [METADATA_URL])
})

test('refuses a response larger than maxResponseBytes', async () => {
    const o = origin({
        metadata: { issuer: ID, jwks_uri: JWKS_URL, pad: 'x'.repeat(4096) },
        jwks: { keys: [] },
    })
    const resolver = createKeyResolver({
        fetch: o.fetch,
        maxResponseBytes: 1024,
    })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        /exceeds 1024 bytes/,
    )
})

test('issuer mismatch keeps its code, and is not stored as a document', async () => {
    const o = origin({
        metadata: { issuer: 'https://other.example', jwks_uri: JWKS_URL },
        jwks: { keys: [] },
    })
    const { store, entries } = mapStore()
    const resolver = createKeyResolver({ fetch: o.fetch, store })

    for (let i = 0; i < 2; i++) {
        await assert.rejects(
            resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
            (error: unknown) =>
                error instanceof SignatureVerificationError &&
                error.code === 'issuer_mismatch',
        )
    }
    assert.strictEqual(o.calls.length, 1, 'the failure holds the floor')
    assert.strictEqual(entries.get(METADATA_URL)?.body, null)
})

test('issuer missing is reported as issuer_missing', async () => {
    const o = origin({ metadata: { jwks_uri: JWKS_URL }, jwks: { keys: [] } })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await assert.rejects(
        resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        (error: unknown) =>
            error instanceof SignatureVerificationError &&
            error.code === 'issuer_missing',
    )
})

test('requireIssuer: false accepts a document with no issuer', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({
        metadata: { jwks_uri: JWKS_URL },
        jwks: { keys: [publicJwk] },
    })
    const resolver = createKeyResolver({ fetch: o.fetch })

    const jwks = await resolver.getJwks(ID, DWK, { requireIssuer: false })
    assert.deepStrictEqual(jwks.keys, [publicJwk])
})

test('allowInlineJwks: uses a JWKS embedded in the metadata', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({
        metadata: { issuer: ID, jwks: { keys: [publicJwk] } },
        jwks: { keys: [] },
    })
    const resolver = createKeyResolver({ fetch: o.fetch })

    const key = await resolver.resolveKey({
        id: ID,
        dwk: DWK,
        kid: 'key-1',
        allowInlineJwks: true,
    })
    assert.deepStrictEqual(key, publicJwk)
    assert.deepStrictEqual(o.calls, [METADATA_URL])
})

test('getMetadata returns the document', async () => {
    const o = origin({
        metadata: { ...metadata, name: 'Signer' },
        jwks: { keys: [] },
    })
    const resolver = createKeyResolver({ fetch: o.fetch })

    const doc = await resolver.getMetadata(ID, DWK)
    assert.strictEqual(doc.name, 'Signer')
})

test('concurrent lookups share one fetch per document', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const resolver = createKeyResolver({ fetch: o.fetch })

    await Promise.all(
        Array.from({ length: 10 }, () =>
            resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' }),
        ),
    )
    assert.deepStrictEqual(o.calls, [METADATA_URL, JWKS_URL])
})

test('an onFetch hook that throws does not fail the lookup', async () => {
    const { publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const resolver = createKeyResolver({
        fetch: o.fetch,
        onFetch: () => {
            throw new Error('logger is down')
        },
    })

    const key = await resolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    assert.deepStrictEqual(key, publicJwk)
})

async function signedHeaders(privateJwk: JsonWebKey) {
    const result = (await signedFetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'jwks_uri', id: ID, dwk: DWK, kid: 'key-1' },
        dryRun: true,
    })) as { headers: Headers }
    return result.headers
}

test('verify: uses the keyResolver it is given', async () => {
    const { privateJwk, publicJwk } = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [publicJwk] } })
    const events: KeyFetchEvent[] = []
    const keyResolver = createKeyResolver({
        fetch: o.fetch,
        onFetch: (e) => events.push(e),
    })

    const result = await verify(
        {
            method: 'GET',
            path: '/data',
            authority: 'api.example.com',
            headers: await signedHeaders(privateJwk),
        },
        { keyResolver },
    )
    assert.strictEqual(result.verified, true)
    assert.strictEqual(result.keyType, 'jwks_uri')
    assert.strictEqual(events.length, 2)
})

test('verify: an unknown kid is reported as unknown_key', async () => {
    const { privateJwk } = await generateKey('key-1')
    const other = await generateKey('key-9')
    const o = origin({ metadata, jwks: { keys: [other.publicJwk] } })
    const keyResolver = createKeyResolver({ fetch: o.fetch })

    const result = await verify(
        {
            method: 'GET',
            path: '/data',
            authority: 'api.example.com',
            headers: await signedHeaders(privateJwk),
        },
        { keyResolver },
    )
    assert.strictEqual(result.verified, false)
    assert.deepStrictEqual(result.signatureError, { error: 'unknown_key' })
})

test('verify: refreshOnVerifyFailure picks up a key replaced under the same kid', async () => {
    const old = await generateKey('key-1')
    const current = await generateKey('key-1')
    const o = origin({ metadata, jwks: { keys: [old.publicJwk] } })
    const keyResolver = createKeyResolver({
        fetch: o.fetch,
        minRefetchIntervalMs: 0,
    })
    const request = async () => ({
        method: 'GET',
        path: '/data',
        authority: 'api.example.com',
        headers: await signedHeaders(current.privateJwk),
    })

    // Warm the store with the old key, then replace it at the origin.
    await keyResolver.resolveKey({ id: ID, dwk: DWK, kid: 'key-1' })
    o.state.jwks = { keys: [current.publicJwk] }

    const without = await verify(await request(), { keyResolver })
    assert.strictEqual(without.verified, false)

    const withRefresh = await verify(await request(), {
        keyResolver,
        refreshOnVerifyFailure: true,
    })
    assert.strictEqual(withRefresh.verified, true)
    assert.deepStrictEqual(withRefresh.publicKey, current.publicJwk)
})

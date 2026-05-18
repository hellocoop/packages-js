/**
 * Tests for the `returnSent: true` option, which surfaces the signed
 * request headers alongside the Response so callers can log/audit the
 * actual on-the-wire request.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch } from '../src/index.js'
import type { HttpSigFetchResultWithSent } from '../src/index.js'

async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    return { privateJwk }
}

/**
 * Install a one-shot stub of globalThis.fetch that records the request
 * and returns a synthetic Response. Returns a restore function.
 */
function stubFetch(): {
    received: { url: string; method: string; headers: Headers }[]
    restore: () => void
} {
    const received: { url: string; method: string; headers: Headers }[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (input: any, init?: any) => {
        const req = new Request(input as string, init)
        received.push({
            url: req.url,
            method: req.method,
            headers: new Headers(req.headers),
        })
        return new Response('{"ok":true}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })
    }) as typeof globalThis.fetch
    return {
        received,
        restore: () => {
            globalThis.fetch = original
        },
    }
}

test('returnSent: returns { response, sent } and signs the request', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const stub = stubFetch()
    try {
        const result = (await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: { type: 'hwk' },
            returnSent: true,
        })) as HttpSigFetchResultWithSent

        // Shape: { response, sent }
        assert.ok(result.response, 'has response')
        assert.ok(result.sent, 'has sent')
        assert.strictEqual(result.response.status, 200)

        // Sent has the on-the-wire request data
        assert.strictEqual(result.sent.method, 'GET')
        assert.strictEqual(result.sent.url, 'https://api.example.com/data')
        assert.ok(
            result.sent.headers.get('signature'),
            'sent.headers carries Signature',
        )
        assert.ok(
            result.sent.headers.get('signature-input'),
            'sent.headers carries Signature-Input',
        )
        assert.ok(
            result.sent.headers.get('signature-key'),
            'sent.headers carries Signature-Key',
        )

        // The stub received the same signed headers
        assert.strictEqual(stub.received.length, 1)
        assert.strictEqual(
            stub.received[0].headers.get('signature'),
            result.sent.headers.get('signature'),
            'wire headers match sent.headers',
        )
    } finally {
        stub.restore()
    }
})

test('returnSent: includes body in sent for POST requests', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const stub = stubFetch()
    try {
        const body = JSON.stringify({ resource_token: 'abc.def.ghi' })
        const result = (await fetch('https://ps.example.com/aauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signingKey: privateJwk,
            signatureKey: { type: 'hwk' },
            returnSent: true,
        })) as HttpSigFetchResultWithSent

        assert.strictEqual(result.sent.method, 'POST')
        assert.strictEqual(result.sent.body, body, 'sent.body is the raw body')
        // content-type comes from inputHeaders (set in this test) or is
        // auto-derived from the body shape; in either case it's present in
        // the signed headers because POST defaults cover it.
        assert.ok(
            result.sent.headers.get('content-type'),
            'POST body has a content-type header in sent.headers',
        )
    } finally {
        stub.restore()
    }
})

test('returnSent: undefined or false returns Response as before', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    const stub = stubFetch()
    try {
        // Default — no returnSent
        const r1 = await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: { type: 'hwk' },
        })
        assert.ok(r1 instanceof Response, 'plain Response returned by default')

        // Explicit false
        const r2 = await fetch('https://api.example.com/data', {
            method: 'GET',
            signingKey: privateJwk,
            signatureKey: { type: 'hwk' },
            returnSent: false,
        })
        assert.ok(r2 instanceof Response, 'plain Response returned when false')
    } finally {
        stub.restore()
    }
})

test('returnSent: ignored when dryRun is also true (dryRun wins)', async () => {
    const { privateJwk } = await generateEd25519KeyPair()
    // No need to stub — dryRun skips the network entirely.
    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
        returnSent: true,
    })) as { headers: Headers }

    // dryRun's existing shape: { headers }
    assert.ok(result.headers, 'dryRun returns { headers }')
    assert.ok(
        !('response' in (result as any)),
        'dryRun result does not have response',
    )
})

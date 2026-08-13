/**
 * Tests for content-digest coverage per the AAuth HTTPSig profile (Section 10.3)
 *
 * A request carrying a body to a PS or AS endpoint MUST cover content-digest
 * (RFC 9530). The signer covers it automatically whenever the body's exact
 * bytes are available to hash (contentDigest: 'auto', the default), refuses
 * to sign a non-digestible body under 'require', and leaves it off under
 * 'omit'. The verifier enforces coverage with requireContentDigest.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'
import { generateContentDigest } from '../src/utils/signature.js'

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

test('auto: string body is covered by content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = JSON.stringify({ foo: 'bar' })

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(
        headers.get('content-digest'),
        'content-digest header should be set',
    )
    assert.ok(
        headers.get('signature-input')!.includes('"content-digest"'),
        'signature-input should cover content-digest',
    )

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body,
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, true, 'Signature should verify')
})

test('auto: Uint8Array body is covered by content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = new TextEncoder().encode('binary payload')

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(headers.get('content-digest'))
    assert.ok(headers.get('signature-input')!.includes('"content-digest"'))

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body,
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, true)
})

test('auto: ArrayBuffer body is covered by content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const bytes = new TextEncoder().encode('buffer payload')
    const body = bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(headers.get('content-digest'))
    assert.ok(headers.get('signature-input')!.includes('"content-digest"'))

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body: new Uint8Array(body),
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, true)
})

test('auto: Buffer body is covered by content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = Buffer.from('node buffer payload')

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(headers.get('content-digest'))
    assert.ok(headers.get('signature-input')!.includes('"content-digest"'))

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body,
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, true)
})

test('auto: ReadableStream body is signed without content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('streamed'))
            controller.close()
        },
    })

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(
        headers.get('content-digest'),
        null,
        'content-digest header should not be set for a stream',
    )
    assert.ok(
        !headers.get('signature-input')!.includes('content-digest'),
        'signature-input should not cover content-digest for a stream',
    )
})

test('auto: FormData body is signed without content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = new FormData()
    body.append('field', 'value')

    // FormData gets no content-type here (the fetch implementation generates
    // the multipart boundary), so the default body components cannot apply.
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        components: ['@method', '@authority', '@path', 'signature-key'],
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(headers.get('content-digest'), null)
    assert.ok(!headers.get('signature-input')!.includes('content-digest'))
})

test('auto: Blob body is signed without content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = new Blob(['blob payload'], { type: 'text/plain' })

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(headers.get('content-digest'), null)
    assert.ok(!headers.get('signature-input')!.includes('content-digest'))
})

test('require: digestible body is covered by content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = 'payload'

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        contentDigest: 'require',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(headers.get('content-digest'))
    assert.ok(headers.get('signature-input')!.includes('"content-digest"'))
})

test('require: non-digestible bodies throw', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const stream = new ReadableStream({
        start(controller) {
            controller.close()
        },
    })
    const formData = new FormData()
    formData.append('field', 'value')
    const blob = new Blob(['blob payload'], { type: 'text/plain' })

    for (const body of [stream, formData, blob]) {
        await assert.rejects(
            fetch('https://api.example.com/data', {
                method: 'POST',
                body,
                contentDigest: 'require',
                signingKey: privateJwk,
                signatureKey: { type: 'hwk' },
                dryRun: true,
            }),
            /cannot be digested/,
            `${body.constructor.name} should be refused under 'require'`,
        )
    }
})

test('omit: string body is signed without content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = 'payload'

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        contentDigest: 'omit',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.strictEqual(
        headers.get('content-digest'),
        null,
        'omit should not add content-digest',
    )
    assert.ok(!headers.get('signature-input')!.includes('content-digest'))

    // Pre-2.2 behavior: the signature still verifies when the verifier does
    // not require coverage.
    const result = await verify({
        method: 'POST',
        path: '/data',
        authority: 'api.example.com',
        headers,
        body,
    })
    assert.strictEqual(result.verified, true)
})

test('omit: explicit content-digest component is still covered', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = 'payload'

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        contentDigest: 'omit',
        components: [
            '@method',
            '@authority',
            '@path',
            'content-type',
            'content-digest',
            'signature-key',
        ],
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    assert.ok(
        headers.get('content-digest'),
        'explicitly listed content-digest should still be generated',
    )
    assert.ok(headers.get('signature-input')!.includes('"content-digest"'))
})

test('generateContentDigest: hashes the four digestible types', async () => {
    const text = 'digest me'
    const expected = await generateContentDigest(text)

    assert.match(expected, /^sha-256=:[A-Za-z0-9+/=]+:$/)

    const bytes = new TextEncoder().encode(text)
    assert.strictEqual(await generateContentDigest(bytes), expected)
    assert.strictEqual(
        await generateContentDigest(
            bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer,
        ),
        expected,
    )
    assert.strictEqual(await generateContentDigest(Buffer.from(text)), expected)
})

test('generateContentDigest: throws on unhandled body types', async () => {
    // Before 2.2.0 these fell through to String(body), producing a valid
    // signature over the SHA-256 of literal text like
    // "[object ReadableStream]" -- bytes that never go on the wire.
    const stream = new ReadableStream({
        start(controller) {
            controller.close()
        },
    })
    const formData = new FormData()
    const blob = new Blob(['x'])

    for (const body of [stream, formData, blob]) {
        await assert.rejects(
            generateContentDigest(body as any),
            /Cannot generate content-digest/,
            `${body.constructor.name} should be refused`,
        )
    }
})

test('requireContentDigest: fails when signature does not cover content-digest', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const body = 'payload'

    // Sign without content-digest coverage
    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body,
        contentDigest: 'omit',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body,
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, false)
    assert.strictEqual(result.signatureError?.error, 'invalid_input')
    assert.ok(
        result.signatureError?.required_input?.includes('content-digest'),
        'required_input should name content-digest',
    )
})

test('requireContentDigest: fails when the digest does not match the body', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'POST',
        body: 'original body',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const result = await verify(
        {
            method: 'POST',
            path: '/data',
            authority: 'api.example.com',
            headers,
            body: 'tampered body',
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, false)
    assert.ok(
        result.error?.includes('content-digest'),
        'error should name content-digest',
    )
})

test('requireContentDigest: passes on a request without a body', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const { headers } = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const result = await verify(
        {
            method: 'GET',
            path: '/data',
            authority: 'api.example.com',
            headers,
        },
        { requireContentDigest: true },
    )

    assert.strictEqual(result.verified, true)
})

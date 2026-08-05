/**
 * Tests for Accept-Signature, Accept-Signature-Scheme and Accept-Signature-Alg
 *
 * The sigkey parameter was removed in -07: a Structured Fields parameter value
 * is a bare Item and cannot be a list, so it could name only one scheme. The
 * accepted sets now travel in their own header fields as Lists of Tokens.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import {
    generateAcceptSignatureHeader,
    parseAcceptSignature,
    generateAcceptSignatureSchemeHeader,
    parseAcceptSignatureScheme,
    generateAcceptSignatureAlgHeader,
    parseAcceptSignatureAlg,
} from '../src/utils/signature.js'
import type { AcceptSignatureParams } from '../src/types.js'

test('Accept-Signature: generate with components only', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig1',
        components: ['@method', '@path', '@authority'],
    })
    assert.strictEqual(header, 'sig1=("@method" "@path" "@authority")')
})

test('Accept-Signature: generate with alg', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig1',
        components: ['@method', '@authority', '@path'],
        alg: 'ed25519',
    })
    assert.strictEqual(
        header,
        'sig1=("@method" "@authority" "@path");alg="ed25519"',
    )
})

test('Accept-Signature: generate with tag', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig',
        components: ['@method', '@path'],
        tag: 'my-app',
    })
    assert.strictEqual(header, 'sig=("@method" "@path");tag="my-app"')
})

test('Accept-Signature: parse components and alg', () => {
    const result = parseAcceptSignature(
        'sig1=("@method" "@authority" "@path");alg="ed25519"',
    )
    assert.strictEqual(result.label, 'sig1')
    assert.deepStrictEqual(result.components, [
        '@method',
        '@authority',
        '@path',
    ])
    assert.strictEqual(result.alg, 'ed25519')
})

test('Accept-Signature: parse throws on invalid format', () => {
    assert.throws(
        () => parseAcceptSignature('invalid-header'),
        /Invalid Accept-Signature format/,
    )
})

test('Accept-Signature: roundtrip', () => {
    const params: AcceptSignatureParams[] = [
        {
            label: 'sig1',
            components: ['@method', '@path', '@authority'],
        },
        {
            label: 'sig',
            components: ['@method', '@authority', '@path'],
            alg: 'ed25519',
        },
        {
            label: 'sig',
            components: ['@method', '@path'],
            tag: 'enterprise',
        },
    ]

    for (const param of params) {
        const header = generateAcceptSignatureHeader(param)
        const parsed = parseAcceptSignature(header)
        assert.deepStrictEqual(
            parsed,
            param,
            `Roundtrip failed for ${JSON.stringify(param)}`,
        )
    }
})

test('Accept-Signature-Scheme: generate a list in preference order', () => {
    assert.strictEqual(
        generateAcceptSignatureSchemeHeader(['jwks_uri', 'jwt', 'hwk']),
        'jwks_uri, jwt, hwk',
    )
})

test('Accept-Signature-Scheme: generate a single scheme', () => {
    assert.strictEqual(generateAcceptSignatureSchemeHeader(['hwk']), 'hwk')
})

test('Accept-Signature-Scheme: parse a list', () => {
    assert.deepStrictEqual(parseAcceptSignatureScheme('jwks_uri, jwt, hwk'), [
        'jwks_uri',
        'jwt',
        'hwk',
    ])
})

test('Accept-Signature-Scheme: parse tolerates irregular whitespace', () => {
    assert.deepStrictEqual(parseAcceptSignatureScheme('  hwk ,jwt   '), [
        'hwk',
        'jwt',
    ])
})

test('Accept-Signature-Scheme: preserves schemes it does not recognize', () => {
    // A client ignores what it does not know, so a server may list schemes
    // registered after the client was written without breaking it.
    assert.deepStrictEqual(
        parseAcceptSignatureScheme('hwk, some-future-scheme'),
        ['hwk', 'some-future-scheme'],
    )
})

test('Accept-Signature-Alg: generate and parse fully-specified identifiers', () => {
    const header = generateAcceptSignatureAlgHeader([
        'Ed25519',
        'ES256',
        'ML-DSA-44',
    ])
    assert.strictEqual(header, 'Ed25519, ES256, ML-DSA-44')
    assert.deepStrictEqual(parseAcceptSignatureAlg(header), [
        'Ed25519',
        'ES256',
        'ML-DSA-44',
    ])
})

test('Accept-Signature-Alg: rejects a value that is not a valid token', () => {
    assert.throws(
        () => generateAcceptSignatureAlgHeader(['Ed25519', 'not a token']),
        /not a valid Structured Field Token/,
    )
})

test('Accept-Signature-Alg: parse drops non-token entries', () => {
    assert.deepStrictEqual(
        parseAcceptSignatureAlg('Ed25519, "quoted", ES256'),
        ['Ed25519', 'ES256'],
    )
})

test('Accept-Signature-*: empty header parses to an empty list', () => {
    assert.deepStrictEqual(parseAcceptSignatureScheme(''), [])
    assert.deepStrictEqual(parseAcceptSignatureAlg(''), [])
})

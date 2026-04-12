/**
 * Tests for Accept-Signature header generation and parsing
 */

import { test } from 'node:test'
import assert from 'node:assert'
import {
    generateAcceptSignatureHeader,
    parseAcceptSignature,
} from '../src/utils/signature.js'
import type { AcceptSignatureParams } from '../src/types.js'

test('Accept-Signature: generate with sigkey=jkt', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig1',
        components: ['@method', '@path', '@authority'],
        sigkey: 'jkt',
    })
    assert.strictEqual(
        header,
        'sig1=("@method" "@path" "@authority");sigkey=jkt',
    )
})

test('Accept-Signature: generate with sigkey=uri and alg', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig1',
        components: ['@method', '@authority', '@path'],
        sigkey: 'uri',
        alg: 'ecdsa-p256-sha256',
    })
    assert.strictEqual(
        header,
        'sig1=("@method" "@authority" "@path");sigkey=uri;alg="ecdsa-p256-sha256"',
    )
})

test('Accept-Signature: generate with sigkey=x509', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig',
        components: ['@method', '@path', '@authority'],
        sigkey: 'x509',
    })
    assert.strictEqual(
        header,
        'sig=("@method" "@path" "@authority");sigkey=x509',
    )
})

test('Accept-Signature: generate without sigkey', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig',
        components: ['@method', '@path'],
    })
    assert.strictEqual(header, 'sig=("@method" "@path")')
})

test('Accept-Signature: generate with tag', () => {
    const header = generateAcceptSignatureHeader({
        label: 'sig',
        components: ['@method', '@path'],
        sigkey: 'jkt',
        tag: 'my-app',
    })
    assert.strictEqual(
        header,
        'sig=("@method" "@path");sigkey=jkt;tag="my-app"',
    )
})

test('Accept-Signature: parse with sigkey=jkt', () => {
    const result = parseAcceptSignature(
        'sig1=("@method" "@path" "@authority");sigkey=jkt',
    )
    assert.strictEqual(result.label, 'sig1')
    assert.deepStrictEqual(result.components, [
        '@method',
        '@path',
        '@authority',
    ])
    assert.strictEqual(result.sigkey, 'jkt')
    assert.strictEqual(result.alg, undefined)
})

test('Accept-Signature: parse with sigkey=uri and alg', () => {
    const result = parseAcceptSignature(
        'sig1=("@method" "@authority" "@path");alg="ecdsa-p256-sha256";sigkey=uri',
    )
    assert.strictEqual(result.label, 'sig1')
    assert.deepStrictEqual(result.components, [
        '@method',
        '@authority',
        '@path',
    ])
    assert.strictEqual(result.sigkey, 'uri')
    assert.strictEqual(result.alg, 'ecdsa-p256-sha256')
})

test('Accept-Signature: parse without sigkey', () => {
    const result = parseAcceptSignature('sig=("@method" "@path")')
    assert.strictEqual(result.label, 'sig')
    assert.deepStrictEqual(result.components, ['@method', '@path'])
    assert.strictEqual(result.sigkey, undefined)
})

test('Accept-Signature: parse with tag', () => {
    const result = parseAcceptSignature(
        'sig=("@method" "@path");sigkey=jkt;tag="my-app"',
    )
    assert.strictEqual(result.sigkey, 'jkt')
    assert.strictEqual(result.tag, 'my-app')
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
            sigkey: 'jkt',
        },
        {
            label: 'sig',
            components: ['@method', '@authority', '@path'],
            sigkey: 'uri',
            alg: 'ecdsa-p256-sha256',
        },
        {
            label: 'sig',
            components: ['@method', '@path'],
        },
        {
            label: 'sig',
            components: ['@method', '@path'],
            sigkey: 'x509',
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

/**
 * Tests for Signature-Error header generation and parsing
 */

import { test } from 'node:test'
import assert from 'node:assert'
import {
    generateSignatureErrorHeader,
    parseSignatureError,
} from '../src/utils/signature.js'
import type { SignatureError } from '../src/types.js'

test('Signature-Error: generate unsupported_algorithm', () => {
    // The supported_algorithms member was removed in -07. A server states what
    // would have worked in Accept-Signature-Alg, which works on a challenge
    // and on an error alike.
    const error: SignatureError = { error: 'unsupported_algorithm' }
    const header = generateSignatureErrorHeader(error)
    assert.strictEqual(header, 'error=unsupported_algorithm')
})

test('Signature-Error: generate unsupported_scheme', () => {
    const header = generateSignatureErrorHeader({ error: 'unsupported_scheme' })
    assert.strictEqual(header, 'error=unsupported_scheme')
})

test('Signature-Error: generate invalid_signature', () => {
    const error: SignatureError = { error: 'invalid_signature' }
    const header = generateSignatureErrorHeader(error)
    assert.strictEqual(header, 'error=invalid_signature')
})

test('Signature-Error: generate invalid_input with required_input', () => {
    const error: SignatureError = {
        error: 'invalid_input',
        required_input: [
            '@method',
            '@authority',
            '@path',
            'signature-key',
            'content-digest',
        ],
    }
    const header = generateSignatureErrorHeader(error)
    assert.strictEqual(
        header,
        'error=invalid_input, required_input=("@method" "@authority" "@path" "signature-key" "content-digest")',
    )
})

test('Signature-Error: generate all simple error codes', () => {
    const codes = [
        'invalid_request',
        'invalid_key',
        'unknown_key',
        'invalid_jwt',
        'expired_jwt',
    ] as const

    for (const code of codes) {
        const header = generateSignatureErrorHeader({ error: code })
        assert.strictEqual(header, `error=${code}`)
    }
})

test('Signature-Error: parse unsupported_algorithm', () => {
    const result = parseSignatureError('error=unsupported_algorithm')
    assert.strictEqual(result.error, 'unsupported_algorithm')
})

test('Signature-Error: parse unsupported_scheme', () => {
    const result = parseSignatureError('error=unsupported_scheme')
    assert.strictEqual(result.error, 'unsupported_scheme')
})

test('Signature-Error: parse invalid_signature', () => {
    const result = parseSignatureError('error=invalid_signature')
    assert.strictEqual(result.error, 'invalid_signature')
    assert.strictEqual(result.required_input, undefined)
})

test('Signature-Error: parse invalid_input with required_input', () => {
    const header =
        'error=invalid_input, required_input=("@method" "@authority" "@path" "signature-key")'
    const result = parseSignatureError(header)
    assert.strictEqual(result.error, 'invalid_input')
    assert.deepStrictEqual(result.required_input, [
        '@method',
        '@authority',
        '@path',
        'signature-key',
    ])
})

test('Signature-Error: parse throws on missing error', () => {
    assert.throws(
        () => parseSignatureError('required_input=("@method")'),
        /missing error member/,
    )
})

test('Signature-Error: parse throws on invalid error code', () => {
    assert.throws(
        () => parseSignatureError('error=not_a_valid_code'),
        /Invalid Signature-Error code/,
    )
})

test('Signature-Error: roundtrip all error types', () => {
    const errors: SignatureError[] = [
        { error: 'unsupported_algorithm' },
        { error: 'unsupported_scheme' },
        { error: 'invalid_signature' },
        {
            error: 'invalid_input',
            required_input: ['@method', '@path'],
        },
        { error: 'invalid_request' },
        { error: 'invalid_key' },
        { error: 'unknown_key' },
        { error: 'invalid_jwt' },
        { error: 'expired_jwt' },
    ]

    for (const error of errors) {
        const header = generateSignatureErrorHeader(error)
        const parsed = parseSignatureError(header)
        assert.deepStrictEqual(
            parsed,
            error,
            `Roundtrip failed for ${error.error}`,
        )
    }
})

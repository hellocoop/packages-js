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

test('Signature-Error: generate unsupported_algorithm with supported list', () => {
    const error: SignatureError = {
        error: 'unsupported_algorithm',
        supported_algorithms: ['ed25519', 'ecdsa-p256-sha256'],
    }
    const header = generateSignatureErrorHeader(error)
    assert.strictEqual(
        header,
        'error=unsupported_algorithm, supported_algorithms=("ed25519" "ecdsa-p256-sha256")',
    )
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

test('Signature-Error: parse unsupported_algorithm with supported list', () => {
    const header =
        'error=unsupported_algorithm, supported_algorithms=("ed25519" "ecdsa-p256-sha256")'
    const result = parseSignatureError(header)
    assert.strictEqual(result.error, 'unsupported_algorithm')
    assert.deepStrictEqual(result.supported_algorithms, [
        'ed25519',
        'ecdsa-p256-sha256',
    ])
})

test('Signature-Error: parse invalid_signature', () => {
    const result = parseSignatureError('error=invalid_signature')
    assert.strictEqual(result.error, 'invalid_signature')
    assert.strictEqual(result.supported_algorithms, undefined)
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
        () => parseSignatureError('supported_algorithms=("ed25519")'),
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
        {
            error: 'unsupported_algorithm',
            supported_algorithms: ['ed25519'],
        },
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

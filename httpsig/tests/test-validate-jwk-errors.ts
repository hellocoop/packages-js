/**
 * Explicit test showing key validation errors propagate through fetch()
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch } from '../src/index.js'
import { SignatureVerificationError } from '../src/errors.js'

test('fetch() propagates key errors - missing kty', async () => {
    const invalidKey = { x: 'test', alg: 'Ed25519' } as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(
            error instanceof SignatureVerificationError,
            'Should be a SignatureVerificationError',
        )
        assert.strictEqual(error.code, 'invalid_key')
        assert.match(
            error.message,
            /JWK missing required member: kty/,
            'Error message should mention missing kty',
        )
        console.log('✓ Error properly propagated:', error.message)
    }
})

test('fetch() propagates key errors - missing alg', async () => {
    // alg is REQUIRED: the algorithm comes from the key and is not derived
    // from kty and crv.
    const invalidKey = { kty: 'OKP', crv: 'Ed25519', x: 'test' } as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(error instanceof SignatureVerificationError)
        assert.strictEqual(error.code, 'invalid_key')
        assert.match(error.message, /missing required member: alg/)
        console.log('✓ Error properly propagated:', error.message)
    }
})

test('fetch() propagates key errors - unsupported algorithm', async () => {
    const invalidKey = {
        kty: 'UNKNOWN',
        alg: 'NOT-AN-ALGORITHM',
    } as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(error instanceof SignatureVerificationError)
        assert.strictEqual(error.code, 'unsupported_algorithm')
        console.log('✓ Error properly propagated:', error.message)
    }
})

test('fetch() propagates key errors - RSA key missing e', async () => {
    // RSA is supported as of 2.0, but alg must name both padding and hash.
    const invalidKey = { kty: 'RSA', alg: 'PS256', n: 'test' } as JsonWebKey

    await assert.rejects(
        fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        }),
        /RSA JWK missing required member: e/,
    )
})

test('fetch() rejects a key whose kty disagrees with its alg', async () => {
    const invalidKey = {
        kty: 'RSA',
        alg: 'ES256',
        n: 'test',
        e: 'AQAB',
    } as JsonWebKey

    await assert.rejects(
        fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        }),
        /inconsistent with alg "ES256"/,
    )
})

test('fetch() rejects a key whose crv disagrees with its alg', async () => {
    const invalidKey = {
        kty: 'EC',
        crv: 'P-384',
        alg: 'ES256',
        x: 'test',
        y: 'test',
    } as JsonWebKey

    await assert.rejects(
        fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        }),
        /crv "P-384" is inconsistent with alg "ES256"/,
    )
})

test('fetch() rejects the polymorphic EdDSA identifier', async () => {
    const invalidKey = {
        kty: 'OKP',
        crv: 'Ed25519',
        alg: 'EdDSA',
        x: 'test',
    } as JsonWebKey

    await assert.rejects(
        fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        }),
        /Polymorphic algorithm identifier "EdDSA" is not permitted/,
    )
})

test('fetch() rejects symmetric key material', async () => {
    const invalidKey = { kty: 'oct', alg: 'HS256', k: 'secret' } as JsonWebKey

    await assert.rejects(
        fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        }),
        /Symmetric keys are not permitted/,
    )
})

test('fetch() declines ML-DSA as unsupported rather than invalid', async () => {
    const mldsaKey = {
        kty: 'AKP',
        alg: 'ML-DSA-44',
        pub: 'test',
    } as unknown as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: mldsaKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(error instanceof SignatureVerificationError)
        // Absence of support is a reason to decline, not a parsing failure.
        assert.strictEqual(error.code, 'unsupported_algorithm')
    }
})

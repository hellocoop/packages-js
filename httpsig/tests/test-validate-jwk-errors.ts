/**
 * Explicit test showing validateJwk errors propagate through fetch()
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch } from '../src/index.js'

test('fetch() propagates validateJwk errors - missing kty', async () => {
    const invalidKey = { x: 'test' } as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error instance')
        assert.match(
            error.message,
            /JWK missing required field: kty/,
            'Error message should mention missing kty',
        )
        console.log('✓ Error properly propagated:', error.message)
    }
})

test('fetch() propagates validateJwk errors - unsupported type', async () => {
    const invalidKey = { kty: 'UNKNOWN' } as JsonWebKey

    try {
        await fetch('https://api.example.com/data', {
            signingKey: invalidKey,
            signatureKey: { type: 'hwk' },
            dryRun: true,
        })
        assert.fail('Should have thrown an error')
    } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error instance')
        assert.match(
            error.message,
            /Unsupported key type/,
            'Error message should mention unsupported type',
        )
        console.log('✓ Error properly propagated:', error.message)
    }
})

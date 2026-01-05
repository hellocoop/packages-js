/**
 * Tests for Signature-Key header validation (RFC 8941 Dictionary format)
 * Per AAuth spec requirements
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { verify } from '../src/index.js'

/**
 * Test: Missing Signature-Key header
 */
test('Validation: Missing Signature-Key header', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-input':
                'sig=("@method" "@authority" "@path");created=1234567890',
            signature: 'sig=:dGVzdA==:',
        },
    })

    console.log('\nMissing Signature-Key test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('Missing Signature-Key header'))
})

/**
 * Test: Invalid Signature-Key format (parentheses instead of semicolons)
 */
test('Validation: Invalid Signature-Key format (parentheses instead of semicolons)', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key': 'sig=(hwk kty="OKP" crv="Ed25519" x="test")', // Invalid: uses parentheses instead of semicolons
            'signature-input':
                'sig=("@method" "@authority" "@path");created=1234567890',
            signature: 'sig=:dGVzdA==:',
        },
    })

    console.log('\nInvalid Signature-Key format test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('Invalid Signature-Key'))
})

/**
 * Test: Invalid Signature-Key format (invalid scheme)
 */
test('Validation: Invalid Signature-Key format (invalid scheme)', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key': 'sig=invalid;kty="OKP"', // Invalid scheme
            'signature-input':
                'sig=("@method" "@authority" "@path");created=1234567890',
            signature: 'sig=:dGVzdA==:',
        },
    })

    console.log('\nInvalid scheme test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('Unsupported Signature-Key scheme'))
})

/**
 * Test: Multi-member Signature-Key Dictionary (should fail)
 */
test('Validation: Multi-member Signature-Key Dictionary', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            // Two dictionary members (invalid per AAuth)
            'signature-key': 'sig=hwk;kty="OKP", other=hwk;kty="EC"',
            'signature-input':
                'sig=("@method" "@authority" "@path");created=1234567890',
            signature: 'sig=:dGVzdA==:',
        },
    })

    console.log('\nMulti-member Dictionary test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('exactly one dictionary member'))
})

/**
 * Test: Label mismatch - Signature-Key label not in Signature-Input
 */
test('Validation: Label mismatch - no matching Signature-Input', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key': 'sig1=hwk;kty="OKP";crv="Ed25519";x="test"',
            'signature-input':
                'sig2=("@method" "@authority" "@path");created=1234567890', // Different label
            signature: 'sig1=:dGVzdA==:',
        },
    })

    console.log('\nLabel mismatch test (Signature-Input):')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('No Signature-Input found for label'))
    assert.ok(result.error?.includes('sig1'))
})

/**
 * Test: Label mismatch - Signature-Key label not in Signature header
 */
test('Validation: Label mismatch - no matching Signature', async () => {
    const result = await verify(
        {
            method: 'GET',
            authority: 'api.example.com',
            path: '/data',
            headers: {
                'signature-key': 'sig1=hwk;kty="OKP";crv="Ed25519";x="test"',
                'signature-input':
                    'sig1=("@method" "@authority" "@path" "signature-key");created=1234567890',
                signature: 'sig2=:dGVzdA==:', // Different label
            },
        },
        {
            strictAAuth: false, // Disable AAuth check to test label mismatch specifically
            maxClockSkew: 999999999, // Allow any timestamp to avoid clock skew errors
        },
    )

    console.log('\nLabel mismatch test (Signature):')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('No signature found for label'))
    assert.ok(result.error?.includes('sig1'))
})

/**
 * Test: Missing/invalid scheme (empty value after label=)
 */
test('Validation: Missing scheme (invalid format)', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key': 'sig=;kty="OKP"', // Missing scheme token
            'signature-input':
                'sig=("@method" "@authority" "@path");created=1234567890',
            signature: 'sig=:dGVzdA==:',
        },
    })

    console.log('\nMissing scheme test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('Invalid Signature-Key'))
})

/**
 * Test: signature-key not in covered components (AAuth violation)
 */
test('Validation: signature-key not in covered components (strictAAuth=true)', async () => {
    const result = await verify(
        {
            method: 'GET',
            authority: 'api.example.com',
            path: '/data',
            headers: {
                'signature-key': 'sig=hwk;kty="OKP";crv="Ed25519";x="test"',
                // Note: signature-key is NOT in the covered components list
                'signature-input':
                    'sig=("@method" "@authority" "@path");created=1234567890',
                signature: 'sig=:dGVzdA==:',
            },
        },
        {
            strictAAuth: true, // Enforce AAuth profile
        },
    )

    console.log('\nSignature-key not covered (strict AAuth) test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    assert.strictEqual(result.verified, false)
    assert.ok(result.error?.includes('AAuth profile violation'))
    assert.ok(
        result.error?.includes('signature-key must be in covered components'),
    )
})

/**
 * Test: signature-key not in covered components bypasses AAuth check when strictAAuth=false
 */
test('Validation: signature-key not covered bypasses AAuth check with strictAAuth=false', async () => {
    const result = await verify(
        {
            method: 'GET',
            authority: 'api.example.com',
            path: '/data',
            headers: {
                'signature-key': 'sig=hwk;kty="OKP";crv="Ed25519";x="test"',
                // Note: signature-key is NOT in covered components
                'signature-input':
                    'sig=("@method" "@authority" "@path");created=1234567890',
                signature: 'sig=:dGVzdA==:',
            },
        },
        {
            strictAAuth: false, // Disable AAuth profile enforcement
        },
    )

    console.log('\nSignature-key not covered (strictAAuth=false) test:')
    console.log('  Verified:', result.verified)
    console.log('  Error:', result.error)

    // Should NOT fail due to AAuth violation (though it will fail for other reasons like invalid signature)
    assert.strictEqual(result.verified, false, 'Signature should be invalid')
    assert.ok(
        !result.error?.includes('AAuth profile violation'),
        'Should not mention AAuth violation when strictAAuth=false',
    )
})

/**
 * Summary test
 */
test('Signature-Key validation: Summary', () => {
    console.log('\n' + '='.repeat(60))
    console.log('Signature-Key Validation Summary')
    console.log('='.repeat(60))
    console.log('✓ Missing Signature-Key header is rejected')
    console.log('✓ Invalid format (parentheses syntax) is rejected')
    console.log('✓ Invalid scheme is rejected')
    console.log('✓ Multi-member Dictionary is rejected')
    console.log('✓ Label mismatch with Signature-Input is rejected')
    console.log('✓ Label mismatch with Signature is rejected')
    console.log('✓ Missing scheme parameter is rejected')
    console.log('✓ signature-key not covered is rejected (strictAAuth=true)')
    console.log(
        '✓ signature-key not covered bypasses AAuth check (strictAAuth=false)',
    )
    console.log(
        '\nAll RFC 8941 Dictionary format validations working correctly!',
    )
    console.log('AAuth profile requirements properly enforced.')
})

/**
 * RFC 9421 Official Test Vectors
 *
 * These tests verify our implementation against the official RFC 9421 test vectors
 * from Appendix B.2, proving interoperability with the standard.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'

/**
 * Test Vector B.2.6: Signing a Request Using ed25519
 *
 * This test uses the official RFC 9421 test vector B.2.6 which covers:
 * - Ed25519 signature algorithm
 * - Request signing with multiple component types
 * - Components: date, @method, @path, @authority, content-type, content-length
 *
 * Key material from RFC 9421 Appendix B.1.4 (test-key-ed25519)
 */
test('RFC 9421 Test Vector B.2.6: Ed25519 signature verification', async () => {
    // Test message from RFC 9421 Appendix B.2
    const method = 'POST'
    const url = 'https://example.com/foo?param=Value&Pet=dog'

    // Headers from RFC test vector
    // Note: We're adding Signature-Key header (our extension) to provide the public key
    const headers = new Headers({
        host: 'example.com',
        date: 'Tue, 20 Apr 2021 02:07:55 GMT',
        'content-type': 'application/json',
        'content-length': '18',

        // RFC 9421 B.2.6 - Expected signature output
        'signature-input':
            'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
        signature:
            'sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:',

        // We add Signature-Key header with the RFC test public key in hwk format (RFC 8941 Dictionary)
        // This is our extension - allows verify() to get the public key
        // The key is from RFC 9421 Appendix B.1.4 (test-key-ed25519)
        'signature-key':
            'sig-b26=hwk;kty="OKP";crv="Ed25519";x="JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs"',
    })

    // Body from RFC test message
    const body = '{"hello": "world"}'

    console.log('\nRFC 9421 Test Vector B.2.6 - Ed25519')
    console.log('=====================================')
    console.log('Method:', method)
    console.log('URL:', url)
    console.log('Body:', body)
    console.log('\nRFC Headers:')
    console.log('  Date:', headers.get('date'))
    console.log('  Content-Type:', headers.get('content-type'))
    console.log('  Content-Length:', headers.get('content-length'))
    console.log('\nSignature Headers:')
    console.log('  Signature-Input:', headers.get('signature-input'))
    console.log(
        '  Signature:',
        headers.get('signature')?.substring(0, 50) + '...',
    )
    console.log(
        '  Signature-Key:',
        headers.get('signature-key')?.substring(0, 60) + '...',
    )

    // Parse URL to extract authority, path, and query
    const urlObj = new URL(url)

    // Verify the signature
    const result = await verify(
        {
            method,
            path: urlObj.pathname,
            authority: urlObj.host,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers,
            body,
        },
        {
            // Allow larger clock skew since test is from 2021
            maxClockSkew: 999999999,
            strictAAuth: false, // RFC 9421 test vectors are not AAuth profile
        },
    )

    console.log('\nVerification Result:')
    console.log('  Verified:', result.verified)
    console.log('  Label:', result.label)
    console.log('  Key Type:', result.keyType)
    console.log('  Algorithm:', result.publicKey.crv)
    console.log('  Thumbprint:', result.thumbprint)
    console.log('  Created:', new Date(result.created * 1000).toISOString())

    if (!result.verified) {
        console.log('  Error:', result.error)
    }

    // Assertions
    assert.strictEqual(
        result.verified,
        true,
        'RFC 9421 test vector should verify successfully',
    )
    assert.strictEqual(
        result.label,
        'sig-b26',
        'Should use label from RFC test vector',
    )
    assert.strictEqual(result.keyType, 'hwk', 'Should extract key from hwk')
    assert.strictEqual(result.publicKey.kty, 'OKP', 'Should be OKP key')
    assert.strictEqual(
        result.publicKey.crv,
        'Ed25519',
        'Should be Ed25519 curve',
    )
    assert.strictEqual(
        result.publicKey.x,
        'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs',
        'Should extract correct public key',
    )
    assert.strictEqual(
        result.created,
        1618884473,
        'Should extract correct timestamp',
    )

    console.log('\n✓ RFC 9421 Test Vector B.2.6 verified successfully!')
    console.log(
        '  This proves our implementation can verify standard RFC 9421 signatures.',
    )
})

/**
 * Additional test: Verify the signature base construction
 * This test documents what signature base the RFC test vector uses
 */
test('RFC 9421 Test Vector B.2.6: Signature base documentation', async () => {
    console.log('\n\nRFC 9421 Test Vector B.2.6 - Signature Base')
    console.log('============================================')
    console.log('The RFC test vector signs these components:')
    console.log('')
    console.log('  1. "date": Tue, 20 Apr 2021 02:07:55 GMT')
    console.log('  2. "@method": POST')
    console.log('  3. "@path": /foo')
    console.log('  4. "@authority": example.com')
    console.log('  5. "content-type": application/json')
    console.log('  6. "content-length": 18')
    console.log(
        '  7. "@signature-params": ("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
    )
    console.log('')
    console.log(
        'Note: Our implementation now uses @authority + @path (matching RFC and AAuth spec)',
    )
    console.log(
        'Note: Our implementation uses content-digest instead of content-length',
    )
    console.log(
        'Note: Our implementation always includes signature-key in covered components',
    )
    console.log('')
    console.log(
        'However, our verify() can verify any valid RFC 9421 signature,',
    )
    console.log('regardless of which components were signed!')
})

/**
 * Test that we handle the specific components from RFC test vector
 */
test('RFC 9421 Test Vector B.2.6: Component handling', async () => {
    // Verify that our implementation correctly reconstructs the signature base
    // for components it doesn't normally use (@path, @authority, content-length)

    const method = 'POST'
    const url = 'https://example.com/foo?param=Value&Pet=dog'
    const body = '{"hello": "world"}'

    const headers = new Headers({
        host: 'example.com',
        date: 'Tue, 20 Apr 2021 02:07:55 GMT',
        'content-type': 'application/json',
        'content-length': '18',
        'signature-input':
            'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
        signature:
            'sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:',
        'signature-key':
            'sig-b26=hwk;kty="OKP";crv="Ed25519";x="JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs"',
    })

    // Parse URL to extract authority, path, and query
    const urlObj = new URL(url)

    const result = await verify(
        {
            method,
            path: urlObj.pathname,
            authority: urlObj.host,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers,
            body,
        },
        {
            maxClockSkew: 999999999,
            strictAAuth: false, // RFC 9421 test vectors are not AAuth profile
        },
    )

    assert.strictEqual(
        result.verified,
        true,
        'Should correctly handle @path, @authority, and content-length components from RFC test',
    )

    console.log('\n✓ Successfully verified signature using RFC components:')
    console.log('  - @method (standard)')
    console.log('  - @path (now our default per AAuth spec)')
    console.log('  - @authority (now our default per AAuth spec)')
    console.log('  - content-length (we normally use content-digest)')
    console.log("  - date header (we normally don't include)")
})

/**
 * Test using our fetch() with custom components
 */
test('Our fetch() with custom components', async () => {
    // Generate a key pair
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey

    const method = 'POST'
    const url = 'https://example.com/foo?param=Value&Pet=dog'
    const body = '{"hello": "world"}'

    // Use custom components like RFC test vector (but with content-digest instead of content-length)
    const customComponents = [
        'date',
        '@method',
        '@path',
        '@authority',
        'content-type',
        'content-digest',
        'signature-key',
    ]

    console.log('\n\nOur fetch() with custom components')
    console.log('====================================')
    console.log('Method:', method)
    console.log('URL:', url)
    console.log('Custom components:', customComponents.join(', '))

    // Sign with our fetch()
    const { headers } = (await fetch(url, {
        method,
        headers: {
            date: 'Tue, 20 Apr 2021 02:07:55 GMT',
            'content-type': 'application/json',
        },
        body,
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        components: customComponents,
        dryRun: true,
    })) as { headers: Headers }

    console.log('\nGenerated headers:')
    console.log('  Signature-Input:', headers.get('signature-input'))
    console.log(
        '  Signature:',
        headers.get('signature')?.substring(0, 50) + '...',
    )
    console.log(
        '  Signature-Key:',
        headers.get('signature-key')?.substring(0, 60) + '...',
    )
    console.log('  Content-Digest:', headers.get('content-digest'))

    // Parse URL to extract authority, path, and query
    const urlObj = new URL(url)

    // Verify the signature
    const result = await verify(
        {
            method,
            path: urlObj.pathname,
            authority: urlObj.host,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers,
            body,
        },
        {
            maxClockSkew: 999999999, // Large skew for old test date
        },
    )

    console.log('\nVerification Result:')
    console.log('  Verified:', result.verified)
    console.log('  Components signed:', customComponents.length)

    assert.strictEqual(
        result.verified,
        true,
        'Should verify signature created with custom components',
    )

    // Verify that the signature-input includes all our custom components
    const signatureInput = headers.get('signature-input')
    assert.ok(signatureInput, 'Should have signature-input header')
    for (const component of customComponents) {
        assert.ok(
            signatureInput.includes(`"${component}"`),
            `Signature-Input should include ${component}`,
        )
    }

    console.log('\n✓ Successfully used fetch() with custom components!')
    console.log(
        '  This proves our implementation supports RFC 9421-compatible component selection.',
    )
})

/**
 * Test that duplicate components are automatically removed
 */
test('Duplicate components are automatically deduplicated', async () => {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey

    // Include duplicate components
    const componentsWithDuplicates = [
        '@method',
        '@method', // Duplicate
        '@target-uri',
        'content-type',
        'content-type', // Duplicate
        'content-digest',
        'signature-key',
    ]

    const { headers } = (await fetch('https://example.com/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        components: componentsWithDuplicates,
        dryRun: true,
    })) as { headers: Headers }

    const signatureInput = headers.get('signature-input')
    assert.ok(signatureInput, 'Should have signature-input header')

    // Count occurrences of each component in signature-input
    const methodCount = (signatureInput.match(/"@method"/g) || []).length
    const contentTypeCount = (signatureInput.match(/"content-type"/g) || [])
        .length

    assert.strictEqual(methodCount, 1, 'Should have only one @method')
    assert.strictEqual(contentTypeCount, 1, 'Should have only one content-type')

    console.log('\n✓ Duplicates automatically removed!')
    console.log('  @method appears 1 time (not 2)')
    console.log('  content-type appears 1 time (not 2)')
})

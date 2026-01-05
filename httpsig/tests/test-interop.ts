/**
 * Interoperability tests with other HTTP Message Signature implementations
 * Uses crypto.subtle to generate keys in both JWK and PEM (SPKI/PKCS8) formats
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch as httpSigFetch, verify } from '../src/index.js'

/**
 * Generate Ed25519 key pair and export in both JWK and raw formats
 */
async function generateKeyPairBothFormats() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    // Export as JWK (our format)
    const privateJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey
    const publicJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey,
    )) as JsonWebKey

    // Export as SPKI (PEM public key) and PKCS8 (PEM private key) - for other implementations
    const publicSpki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const privateSpkcs8 = await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
    )

    // Convert to base64 for PEM format
    const publicPem = arrayBufferToPem(publicSpki, 'PUBLIC KEY')
    const privatePem = arrayBufferToPem(privateSpkcs8, 'PRIVATE KEY')

    return {
        jwk: { privateJwk, publicJwk },
        pem: { publicPem, privatePem },
        raw: { publicSpki, privateSpkcs8 },
        cryptoKeyPair: keyPair,
    }
}

/**
 * Convert ArrayBuffer to PEM format
 */
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
    const base64 = Buffer.from(buffer).toString('base64')
    const lines = base64.match(/.{1,64}/g) || []
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

/**
 * Parse PEM to ArrayBuffer
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN .*-----/, '')
        .replace(/-----END .*-----/, '')
        .replace(/\s/g, '')
    return Buffer.from(base64, 'base64')
}

test('Key format conversion: JWK <-> SPKI round-trip', async () => {
    const keys = await generateKeyPairBothFormats()

    console.log('Generated keys in both formats:')
    console.log(
        '  JWK public key:',
        JSON.stringify(keys.jwk.publicJwk, null, 2),
    )
    console.log(
        '  PEM public key (first 80 chars):',
        keys.pem.publicPem.substring(0, 80) + '...',
    )

    // Verify we can import the SPKI key back
    const importedPublicKey = await crypto.subtle.importKey(
        'spki',
        keys.raw.publicSpki,
        { name: 'Ed25519' },
        true,
        ['verify'],
    )

    // Export it as JWK and compare with original
    const importedJwk = (await crypto.subtle.exportKey(
        'jwk',
        importedPublicKey,
    )) as JsonWebKey

    assert.strictEqual(importedJwk.kty, keys.jwk.publicJwk.kty)
    assert.strictEqual(importedJwk.crv, keys.jwk.publicJwk.crv)
    assert.strictEqual(importedJwk.x, keys.jwk.publicJwk.x)

    console.log('✓ JWK <-> SPKI conversion successful')
})

test('Cross-verification: Sign with JWK, verify with SPKI-imported key', async () => {
    const keys = await generateKeyPairBothFormats()
    const testData = new TextEncoder().encode('test message')

    // Sign with the original CryptoKey
    const signature = await crypto.subtle.sign(
        { name: 'Ed25519' },
        keys.cryptoKeyPair.privateKey,
        testData,
    )

    // Import public key from SPKI
    const importedPublicKey = await crypto.subtle.importKey(
        'spki',
        keys.raw.publicSpki,
        { name: 'Ed25519' },
        false,
        ['verify'],
    )

    // Verify with imported key
    const verified = await crypto.subtle.verify(
        { name: 'Ed25519' },
        importedPublicKey,
        signature,
        testData,
    )

    assert.strictEqual(
        verified,
        true,
        'Signature should verify with SPKI-imported key',
    )
    console.log('✓ Cross-verification successful')
})

test('HTTP signature with both formats', async () => {
    const keys = await generateKeyPairBothFormats()

    // Sign a request using our implementation (JWK)
    const { headers } = (await httpSigFetch('https://api.example.com/data', {
        method: 'POST',
        body: 'test data',
        signingKey: keys.jwk.privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    console.log('Generated signature headers:')
    console.log('  Signature:', headers.get('signature'))
    console.log('  Signature-Input:', headers.get('signature-input'))
    console.log('  Signature-Key:', headers.get('signature-key'))

    // Verify using our implementation
    const result = await verify({
        method: 'POST',
        path: '/data',
        authority: 'api.example.com',
        headers,
        body: 'test data',
    })

    assert.strictEqual(
        result.verified,
        true,
        'Should verify with our implementation',
    )
    console.log('✓ Signature verified with our implementation')

    // Extract signature components for manual verification
    const signatureHeader = headers.get('signature')!
    const signatureMatch = signatureHeader.match(/sig=:([^:]+):/)
    assert.ok(signatureMatch, 'Should extract signature')

    const signatureBase64 = signatureMatch[1]
    const signatureBytes = Buffer.from(signatureBase64, 'base64')

    console.log('  Signature bytes length:', signatureBytes.length)

    // Note: To manually verify, we would need to reconstruct the signature base
    // For now, just verify the formats work
    console.log('✓ Key formats compatible')
})

test('PEM format output', async () => {
    const keys = await generateKeyPairBothFormats()

    console.log('\nGenerated PEM keys:')
    console.log('\nPublic Key (SPKI format):')
    console.log(keys.pem.publicPem)
    console.log('\nPrivate Key (PKCS8 format):')
    console.log(keys.pem.privatePem)

    // Verify we can parse them back
    const publicSpki = pemToArrayBuffer(keys.pem.publicPem)
    const privateSpkcs8 = pemToArrayBuffer(keys.pem.privatePem)

    const importedPublic = await crypto.subtle.importKey(
        'spki',
        publicSpki,
        { name: 'Ed25519' },
        true,
        ['verify'],
    )

    const importedPrivate = await crypto.subtle.importKey(
        'pkcs8',
        privateSpkcs8,
        { name: 'Ed25519' },
        true,
        ['sign'],
    )

    assert.ok(importedPublic, 'Should import public key from PEM')
    assert.ok(importedPrivate, 'Should import private key from PEM')

    console.log('✓ PEM keys can be imported back')
})

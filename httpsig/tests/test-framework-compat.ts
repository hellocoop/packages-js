/**
 * Test framework compatibility issues
 */

import { test } from 'node:test'
import assert from 'node:assert'

test('URL handling: path-only vs full URL', async () => {
    // Test that our URL parsing handles paths correctly
    const path = '/api/data'
    const fullUrl = 'https://example.com/api/data'

    const urlFromPath = new URL(path, 'http://localhost')
    const urlFromFull = new URL(fullUrl)

    console.log('Path-only URL:', urlFromPath.href)
    console.log('Full URL:', urlFromFull.href)

    // They will be different!
    assert.notStrictEqual(urlFromPath.href, urlFromFull.href)

    console.log(
        '\n⚠️  Issue: Signing with full URL but verifying with path-only will fail!',
    )
})

test('Body handling: parsed object vs raw string', async () => {
    const originalBody = '{"foo":"bar","num":123}'
    const parsedBody = JSON.parse(originalBody)
    const reSerializedBody = JSON.stringify(parsedBody)

    console.log('Original body:     ', originalBody)
    console.log('Re-serialized body:', reSerializedBody)

    // These might not match!
    if (originalBody !== reSerializedBody) {
        console.log(
            '\n⚠️  Issue: JSON.stringify may not preserve original formatting!',
        )
    }

    // Compute digests
    const { sha256, base64Encode } = await import('../src/utils/base64.js')

    const originalHash = await sha256(originalBody)
    const reSerializedHash = await sha256(reSerializedBody)

    const originalDigest = `sha-256=:${base64Encode(originalHash)}:`
    const reSerializedDigest = `sha-256=:${base64Encode(reSerializedHash)}:`

    console.log('\nOriginal digest:      ', originalDigest)
    console.log('Re-serialized digest: ', reSerializedDigest)

    if (originalDigest !== reSerializedDigest) {
        console.log('\n❌ Digests DO NOT match! Verification will fail.')
    } else {
        console.log('\n✓ Digests match (got lucky with this example)')
    }
})

/**
 * The `alg` signature parameter is not used to determine the algorithm
 *
 * RFC 9421 Section 1.4 gives three ways to establish the signature algorithm:
 * state it in the `alg` signature parameter, derive it from the key material,
 * or agree it out of band. This implementation takes the second, which Section
 * 3.3.7 develops for JOSE signing algorithms -- "the explicit alg signature
 * parameter is not used at all when using JOSE signing algorithms".
 *
 * So: signers never emit `alg`, and verifiers ignore it if a signer sends one.
 * Ignoring it is not the same as dropping it -- `alg` lives inside
 * @signature-params, which is covered by the signature, so it must still be
 * reproduced verbatim in the signature base.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { fetch, verify } from '../src/index.js'
import { generateSignatureBase } from '../src/utils/signature.js'
import { base64Encode } from '../src/utils/base64.js'

async function generateEd25519KeyPair() {
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    privateJwk.alg = 'Ed25519'
    publicJwk.alg = 'Ed25519'

    return { privateJwk, publicJwk, privateKey: keyPair.privateKey }
}

/**
 * Sign a request by hand so the covered signature parameters can include an
 * `alg` the library would never emit itself.
 */
async function signWithParams(
    privateKey: CryptoKey,
    publicJwk: JsonWebKey,
    signatureParamsSuffix: string,
) {
    const method = 'GET'
    const authority = 'api.example.com'
    const path = '/data'
    const components = ['@method', '@authority', '@path', 'signature-key']

    const signatureKey =
        `sig=hwk;alg="${publicJwk.alg}";kty="${publicJwk.kty}";` +
        `crv="${publicJwk.crv}";x="${publicJwk.x}"`

    const componentList = components.map((c) => `"${c}"`).join(' ')
    const signatureParams = `(${componentList});${signatureParamsSuffix}`

    const values = new Map<string, string>([
        ['@method', method],
        ['@authority', authority],
        ['@path', path],
        ['signature-key', signatureKey],
        ['@signature-params', signatureParams],
    ])

    const base = generateSignatureBase(
        [...components, '@signature-params'],
        values,
    )

    const signature = new Uint8Array(
        await crypto.subtle.sign(
            { name: 'Ed25519' },
            privateKey,
            new TextEncoder().encode(base),
        ),
    )

    return {
        request: {
            method,
            authority,
            path,
            headers: {
                'signature-key': signatureKey,
                'signature-input': `sig=${signatureParams}`,
                signature: `sig=:${base64Encode(signature)}:`,
            },
        },
    }
}

test('Signature-Input: fetch() never emits an alg parameter', async () => {
    const { privateJwk } = await generateEd25519KeyPair()

    const result = (await fetch('https://api.example.com/data', {
        method: 'GET',
        signingKey: privateJwk,
        signatureKey: { type: 'hwk' },
        dryRun: true,
    })) as { headers: Headers }

    const signatureInput = result.headers.get('signature-input')
    assert.ok(signatureInput, 'Signature-Input should be present')
    assert.ok(
        !/;alg=/.test(signatureInput),
        `Signature-Input must not carry an alg parameter, got: ${signatureInput}`,
    )
})

test('Signature-Input: a signature carrying alg still verifies', async () => {
    // Proves the parameter is reproduced in the signature base. If the
    // verifier dropped it, the base would differ and this would fail.
    const { publicJwk, privateKey } = await generateEd25519KeyPair()
    const created = Math.floor(Date.now() / 1000)

    const { request } = await signWithParams(
        privateKey,
        publicJwk,
        `created=${created};alg="ed25519"`,
    )

    const result = await verify(request)

    assert.strictEqual(
        result.verified,
        true,
        `Should verify with alg present: ${result.error}`,
    )
})

test('Signature-Input: a misleading alg does not change the algorithm used', async () => {
    // The key is Ed25519. The signer declares rsa-pss-sha512. A verifier that
    // honoured the parameter would attempt the wrong operation and fail; one
    // that takes the algorithm from the key verifies successfully.
    const { publicJwk, privateKey } = await generateEd25519KeyPair()
    const created = Math.floor(Date.now() / 1000)

    const { request } = await signWithParams(
        privateKey,
        publicJwk,
        `created=${created};alg="rsa-pss-sha512"`,
    )

    const result = await verify(request)

    assert.strictEqual(
        result.verified,
        true,
        `Misleading alg must be ignored, not honoured: ${result.error}`,
    )
    assert.strictEqual(
        result.publicKey.alg,
        'Ed25519',
        'Algorithm must come from the key, not the signature parameter',
    )
})

test('Signature-Input: an alg naming a banned algorithm is still ignored', async () => {
    // hmac-sha256 is registered for HTTP Message Signatures but is symmetric
    // and forbidden here. Since the parameter is ignored entirely, it neither
    // selects an algorithm nor triggers the symmetric-key rejection -- the
    // key is what is checked, and the key is fine.
    const { publicJwk, privateKey } = await generateEd25519KeyPair()
    const created = Math.floor(Date.now() / 1000)

    const { request } = await signWithParams(
        privateKey,
        publicJwk,
        `created=${created};alg="hmac-sha256"`,
    )

    const result = await verify(request)

    assert.strictEqual(
        result.verified,
        true,
        `Should verify from the key regardless of the alg parameter: ${result.error}`,
    )
    assert.strictEqual(result.publicKey.alg, 'Ed25519')
})

test('Signature-Input: verification still fails when the key itself is wrong', async () => {
    // Guard against the tests above passing for the wrong reason. Sign with
    // one key, present another; ignoring alg must not mean ignoring the key.
    const signer = await generateEd25519KeyPair()
    const other = await generateEd25519KeyPair()
    const created = Math.floor(Date.now() / 1000)

    const { request } = await signWithParams(
        signer.privateKey,
        signer.publicJwk,
        `created=${created};alg="ed25519"`,
    )

    // Swap in a different key without re-signing.
    request.headers['signature-key'] =
        `sig=hwk;alg="Ed25519";kty="${other.publicJwk.kty}";` +
        `crv="${other.publicJwk.crv}";x="${other.publicJwk.x}"`

    const result = await verify(request)

    assert.strictEqual(
        result.verified,
        false,
        'A substituted key must not verify',
    )
})

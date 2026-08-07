/**
 * WebCrypto implementations disagree on which JWK `alg` values importKey
 * accepts. workerd (Cloudflare Workers) rejects an Ed25519 JWK whose `alg`
 * is the fully-specified "Ed25519" that the -08 wire format requires — it
 * expects the polymorphic "EdDSA" or no `alg` at all. Node accepts both, so
 * without this emulation the regression is invisible to the suite.
 *
 * The library must therefore strip `alg` before handing a JWK to importKey:
 * determineAlgorithm has already resolved the operation, and the hint only
 * gives strict implementations something to reject.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { importPrivateKey, importPublicKey } from '../src/utils/crypto.js'

test('importKey never sees a JWK alg member (workerd compatibility)', async (t) => {
    const generated = (await crypto.subtle.generateKey('Ed25519', true, [
        'sign',
        'verify',
    ])) as CryptoKeyPair
    const privateKey: JsonWebKey = {
        ...(await crypto.subtle.exportKey('jwk', generated.privateKey)),
        alg: 'Ed25519',
    }
    const publicKey: JsonWebKey = {
        ...(await crypto.subtle.exportKey('jwk', generated.publicKey)),
        alg: 'Ed25519',
    }

    const realImportKey = crypto.subtle.importKey.bind(crypto.subtle)
    const seenAlgs: (string | undefined)[] = []
    t.mock.method(crypto.subtle, 'importKey', ((
        format: 'jwk',
        keyData: JsonWebKey,
        ...rest: unknown[]
    ) => {
        seenAlgs.push(keyData.alg)
        if (keyData.alg && keyData.alg !== 'EdDSA') {
            // workerd's behavior for OKP keys
            throw new DOMException(
                `JSON Web Key Algorithm parameter "alg" ("${keyData.alg}") does not match requested`,
                'DataError',
            )
        }
        return realImportKey(
            format,
            keyData,
            ...(rest as [AlgorithmIdentifier, boolean, KeyUsage[]]),
        )
    }) as typeof crypto.subtle.importKey)

    await importPrivateKey(privateKey)
    await importPublicKey(publicKey)

    assert.strictEqual(seenAlgs.length, 2)
    assert.deepStrictEqual(seenAlgs, [undefined, undefined])
})

/**
 * Cryptographic utilities for HTTP Message Signatures
 */

import { AlgorithmParams } from '../types.js'

/**
 * Get algorithm parameters from JWK
 */
export function getAlgorithmFromJwk(jwk: JsonWebKey): AlgorithmParams {
    if (jwk.kty === 'OKP') {
        if (jwk.crv === 'Ed25519') {
            return { name: 'Ed25519' }
        }
        throw new Error(`Unsupported OKP curve: ${jwk.crv}`)
    }

    if (jwk.kty === 'EC') {
        if (jwk.crv === 'P-256') {
            return { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
        }
        throw new Error(`Unsupported EC curve: ${jwk.crv}`)
    }

    if (jwk.kty === 'RSA') {
        return {
            name: 'RSA-PSS',
            hash: 'SHA-256',
            saltLength: 32,
        }
    }

    throw new Error(`Unsupported key type: ${jwk.kty}`)
}

/**
 * Import a JWK as a CryptoKey for signing
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    const algorithm = getAlgorithmFromJwk(jwk)

    return await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['sign'])
}

/**
 * Import a JWK as a CryptoKey for verification
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    const algorithm = getAlgorithmFromJwk(jwk)

    return await crypto.subtle.importKey('jwk', jwk, algorithm, false, [
        'verify',
    ])
}

/**
 * Extract public JWK from private JWK
 */
export function getPublicJwk(privateJwk: JsonWebKey): JsonWebKey {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { d, p, q, dp, dq, qi, ...publicJwk } = privateJwk
    return publicJwk
}

/**
 * Sign data with a private key
 */
export async function sign(
    data: Uint8Array,
    privateKey: CryptoKey,
    algorithm: AlgorithmParams,
): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(algorithm, privateKey, data)

    return new Uint8Array(signature)
}

/**
 * Verify signature with a public key
 */
export async function verify(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: CryptoKey,
    algorithm: AlgorithmParams,
): Promise<boolean> {
    return await crypto.subtle.verify(algorithm, publicKey, signature, data)
}

/**
 * Validate JWK structure
 */
export function validateJwk(jwk: JsonWebKey): void {
    if (!jwk.kty) {
        throw new Error('JWK missing required field: kty')
    }

    if (jwk.kty === 'OKP') {
        if (!jwk.crv) throw new Error('OKP JWK missing required field: crv')
        if (!jwk.x) throw new Error('OKP JWK missing required field: x')
    } else if (jwk.kty === 'EC') {
        if (!jwk.crv) throw new Error('EC JWK missing required field: crv')
        if (!jwk.x) throw new Error('EC JWK missing required field: x')
        if (!jwk.y) throw new Error('EC JWK missing required field: y')
    } else if (jwk.kty === 'RSA') {
        if (!jwk.n) throw new Error('RSA JWK missing required field: n')
        if (!jwk.e) throw new Error('RSA JWK missing required field: e')
    } else {
        throw new Error(`Unsupported key type: ${jwk.kty}`)
    }
}

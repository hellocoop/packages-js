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
 * Options for key pair generation
 */
export interface GenerateKeyPairOptions {
    algorithm?: 'Ed25519' | 'ES256' // default: 'Ed25519'
    extractable?: boolean // default: true
}

/**
 * Generated key pair
 */
export interface KeyPair {
    privateKey: CryptoKey // CryptoKey handle for signing
    publicKey: JsonWebKey // Public key as JWK (always exportable)
}

/**
 * Generate a signing key pair
 */
export async function generateKeyPair(
    options?: GenerateKeyPairOptions,
): Promise<KeyPair> {
    const algorithm = options?.algorithm ?? 'Ed25519'
    const extractable = options?.extractable ?? true

    let genAlgorithm:
        | AlgorithmIdentifier
        | RsaHashedKeyGenParams
        | EcKeyGenParams
    let keyUsages: KeyUsage[] = ['sign', 'verify']

    if (algorithm === 'Ed25519') {
        genAlgorithm = { name: 'Ed25519' }
    } else if (algorithm === 'ES256') {
        genAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' }
    } else {
        throw new Error(`Unsupported algorithm: ${algorithm}`)
    }

    const keyPair = (await crypto.subtle.generateKey(
        genAlgorithm,
        extractable,
        keyUsages,
    )) as CryptoKeyPair

    // Public key is always exportable
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    return {
        privateKey: keyPair.privateKey,
        publicKey,
    }
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
    } else {
        throw new Error(`Unsupported key type: ${jwk.kty}`)
    }
}

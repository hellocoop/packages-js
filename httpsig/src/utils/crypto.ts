/**
 * Cryptographic utilities for HTTP Message Signatures
 *
 * Algorithm determination follows draft-hardt-httpbis-signature-key-07,
 * Algorithm Determination: the signature algorithm is taken from the JWK `alg`
 * member, which must be a fully-specified identifier (RFC 9864). It is never
 * derived from `kty` and `crv` -- those underdetermine the algorithm for RSA
 * keys, which have no curve and leave both padding and hash free, and for EC
 * keys, whose curve does not fix the hash.
 */

import { AlgorithmParams } from '../types.js'
import { invalidKey, unsupportedAlgorithm } from '../errors.js'

interface AlgorithmSpec {
    /** The key type this algorithm requires. */
    kty: string
    /** The curve this algorithm requires, where the key type has one. */
    crv?: string
    /**
     * WebCrypto parameters. The same object is passed to importKey and to
     * sign/verify; each ignores the members it does not use.
     */
    params: AlgorithmParams
}

/**
 * Fully-specified JOSE algorithm identifiers this implementation supports.
 *
 * Note ES512 uses P-521, not a "P-512" curve.
 */
export const FULLY_SPECIFIED_ALGORITHMS: Readonly<
    Record<string, AlgorithmSpec>
> = {
    Ed25519: {
        kty: 'OKP',
        crv: 'Ed25519',
        params: { name: 'Ed25519' },
    },
    Ed448: {
        kty: 'OKP',
        crv: 'Ed448',
        params: { name: 'Ed448' },
    },
    ES256: {
        kty: 'EC',
        crv: 'P-256',
        params: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
    },
    ES384: {
        kty: 'EC',
        crv: 'P-384',
        params: { name: 'ECDSA', namedCurve: 'P-384', hash: 'SHA-384' },
    },
    ES512: {
        kty: 'EC',
        crv: 'P-521',
        params: { name: 'ECDSA', namedCurve: 'P-521', hash: 'SHA-512' },
    },
    PS256: {
        kty: 'RSA',
        params: { name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
    },
    PS384: {
        kty: 'RSA',
        params: { name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 },
    },
    PS512: {
        kty: 'RSA',
        params: { name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
    },
    RS256: {
        kty: 'RSA',
        params: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    },
    RS384: {
        kty: 'RSA',
        params: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
    },
    RS512: {
        kty: 'RSA',
        params: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    },
}

/**
 * Identifiers that name a different signature algorithm depending on the key
 * they are used with. Deprecated by RFC 9864 and forbidden by the draft.
 */
export const POLYMORPHIC_ALGORITHMS: ReadonlySet<string> = new Set(['EdDSA'])

/**
 * Shared-secret algorithms. Every scheme here distributes a public key, and a
 * secret handed to the verifier proves nothing, so these are rejected rather
 * than merely unimplemented.
 */
export const SYMMETRIC_ALGORITHMS: ReadonlySet<string> = new Set([
    'HS256',
    'HS384',
    'HS512',
    'hmac-sha256',
])

/**
 * Fully-specified identifiers that are valid but that WebCrypto cannot
 * implement, so they are declined rather than rejected as malformed.
 */
export const UNIMPLEMENTED_ALGORITHMS: ReadonlySet<string> = new Set([
    'ML-DSA-44',
    'ML-DSA-65',
    'ML-DSA-87',
])

/** Key members each key type requires. */
const REQUIRED_MEMBERS: Record<string, string[]> = {
    OKP: ['crv', 'x'],
    EC: ['crv', 'x', 'y'],
    RSA: ['n', 'e'],
}

/**
 * Determine the signature algorithm for a JWK, validating it in the process.
 *
 * Throws a SignatureVerificationError carrying the Signature-Error code the
 * verifier should report.
 */
export function determineAlgorithm(jwk: JsonWebKey): AlgorithmParams {
    if (!jwk || typeof jwk !== 'object') {
        throw invalidKey('JWK is not an object')
    }

    if (!jwk.kty) {
        throw invalidKey('JWK missing required member: kty')
    }

    // A shared secret cannot prove possession to a verifier that holds it.
    if (jwk.kty === 'oct') {
        throw invalidKey(
            'Symmetric keys are not permitted: kty "oct" names a shared secret',
        )
    }

    const alg = jwk.alg

    if (!alg) {
        throw invalidKey(
            'JWK missing required member: alg. The algorithm is taken from the key and is not derived from kty and crv',
        )
    }

    if (SYMMETRIC_ALGORITHMS.has(alg)) {
        throw invalidKey(
            `Symmetric algorithms are not permitted: "${alg}" names a shared secret`,
        )
    }

    if (POLYMORPHIC_ALGORITHMS.has(alg)) {
        throw invalidKey(
            `Polymorphic algorithm identifier "${alg}" is not permitted. Use a fully-specified identifier such as Ed25519 or Ed448 (RFC 9864)`,
        )
    }

    // AKP covers several ML-DSA parameter sets, so the key type alone does not
    // name an algorithm. Declining is a capability statement, not a parse
    // failure, so it reports unsupported_algorithm.
    if (jwk.kty === 'AKP' || UNIMPLEMENTED_ALGORITHMS.has(alg)) {
        throw unsupportedAlgorithm(
            `Algorithm "${alg}" (kty "${jwk.kty}") is not implemented by this verifier`,
        )
    }

    const spec = FULLY_SPECIFIED_ALGORITHMS[alg]
    if (!spec) {
        throw unsupportedAlgorithm(
            `Unsupported or not fully-specified algorithm: "${alg}"`,
        )
    }

    // The key-structure members are redundant with a fully-specified alg. Use
    // the redundancy as a check: a key that can be read two ways is rejected
    // rather than resolved in favour of either reading.
    if (jwk.kty !== spec.kty) {
        throw invalidKey(
            `JWK kty "${jwk.kty}" is inconsistent with alg "${alg}", which requires kty "${spec.kty}"`,
        )
    }

    if (spec.crv && jwk.crv !== spec.crv) {
        throw invalidKey(
            `JWK crv "${jwk.crv}" is inconsistent with alg "${alg}", which requires crv "${spec.crv}"`,
        )
    }

    for (const member of REQUIRED_MEMBERS[spec.kty] ?? []) {
        if (!(jwk as Record<string, unknown>)[member]) {
            throw invalidKey(
                `${spec.kty} JWK missing required member: ${member}`,
            )
        }
    }

    return spec.params
}

/**
 * Get algorithm parameters from a JWK.
 */
export function getAlgorithmFromJwk(jwk: JsonWebKey): AlgorithmParams {
    return determineAlgorithm(jwk)
}

/**
 * Validate a JWK, including that its algorithm is fully specified and
 * consistent with its key material.
 */
export function validateJwk(jwk: JsonWebKey): void {
    determineAlgorithm(jwk)
}

/**
 * Import a JWK as a CryptoKey for signing
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    const algorithm = determineAlgorithm(jwk)

    return await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['sign'])
}

/**
 * Import a JWK as a CryptoKey for verification
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    const algorithm = determineAlgorithm(jwk)

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
 * Algorithms generateKeyPair can produce.
 */
export type GeneratableAlgorithm = 'Ed25519' | 'ES256' | 'ES384' | 'ES512'

/**
 * Options for key pair generation
 */
export interface GenerateKeyPairOptions {
    algorithm?: GeneratableAlgorithm // default: 'Ed25519'
    extractable?: boolean // default: true
}

/**
 * Generated key pair
 */
export interface KeyPair {
    privateKey: CryptoKey // CryptoKey handle for signing
    publicKey: JsonWebKey // Public key as JWK, carrying alg
}

/**
 * Generate a signing key pair.
 *
 * The exported public JWK carries `alg`, which WebCrypto does not set. Without
 * it the key cannot be conveyed by the hwk scheme.
 */
export async function generateKeyPair(
    options?: GenerateKeyPairOptions,
): Promise<KeyPair> {
    const algorithm = options?.algorithm ?? 'Ed25519'
    const extractable = options?.extractable ?? true

    const spec = FULLY_SPECIFIED_ALGORITHMS[algorithm]
    if (!spec) {
        throw new Error(`Unsupported algorithm: ${algorithm}`)
    }

    const genAlgorithm: AlgorithmIdentifier | EcKeyGenParams = spec.crv
        ? spec.params.name === 'ECDSA'
            ? { name: 'ECDSA', namedCurve: spec.crv }
            : { name: spec.params.name }
        : { name: spec.params.name }

    const keyPair = (await crypto.subtle.generateKey(
        genAlgorithm,
        extractable,
        ['sign', 'verify'],
    )) as CryptoKeyPair

    // Public key is always exportable
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

    // WebCrypto omits alg; the draft requires it.
    publicKey.alg = algorithm

    return {
        privateKey: keyPair.privateKey,
        publicKey,
    }
}

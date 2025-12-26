/**
 * Type definitions for @hellocoop/httpsig
 */

export type SignatureKeyType =
    | { type: 'hwk' }
    | { type: 'jwt'; jwt: string }
    | { type: 'jwks'; id: string; kid: string; wellKnown?: string }

export interface HttpSigFetchOptions extends RequestInit {
    // Required: Private key as JWK
    signingKey: JsonWebKey

    // Required: Signature-Key header configuration
    signatureKey: SignatureKeyType

    // Optional parameters
    label?: string // Signature label (default: 'sig')

    // Testing mode
    dryRun?: boolean // Return headers without fetching (still returns Promise)
}

export interface VerifyRequest {
    method: string
    url: string
    headers: Headers | Record<string, string | string[]>
    body?: string | Buffer | Uint8Array
}

export interface VerifyOptions {
    // Timestamp validation
    maxClockSkew?: number // Max clock skew in seconds (default: 60)

    // JWKS caching
    jwksCacheTtl?: number // JWKS cache TTL in ms (default: 3600000)
}

export interface VerificationResult {
    verified: boolean // Overall verification status
    label: string // Signature label used
    keyType: 'hwk' | 'jwt' | 'jwks'
    publicKey: JsonWebKey // Extracted public key
    thumbprint: string // JWK thumbprint (RFC 7638) - stable key identifier
    created: number // Signature timestamp

    // JWT-specific fields (if keyType === 'jwt')
    // Note: JWT is NOT validated - caller must validate issuer, expiration, etc.
    jwt?: {
        header: object
        payload: object
        raw: string // Raw JWT for caller to validate
    }

    // JWKS-specific fields (if keyType === 'jwks')
    jwks?: {
        id: string
        kid: string
        wellKnown?: string
    }

    // Error information
    error?: string
}

export interface ParsedSignatureInput {
    label: string
    components: string[]
    params: {
        created: number
        [key: string]: any
    }
}

export interface ParsedSignatureKey {
    label: string
    type: 'hwk' | 'jwt' | 'jwks'
    value: HwkValue | JwtValue | JwksValue
}

export interface HwkValue {
    kty: string
    crv?: string
    x?: string
    y?: string
    n?: string
    e?: string
}

export interface JwtValue {
    jwt: string
}

export interface JwksValue {
    id: string
    kid: string
    wellKnown?: string
}

/**
 * Supported signature algorithms
 */
export type SignatureAlgorithm = 'Ed25519' | 'ES256' | 'RS256'

/**
 * Algorithm parameters for signing
 */
export interface AlgorithmParams {
    name: string
    hash?: string
    namedCurve?: string
    modulusLength?: number
    publicExponent?: Uint8Array
    saltLength?: number
}

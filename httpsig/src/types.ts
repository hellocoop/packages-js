/**
 * Type definitions for @hellocoop/httpsig
 */

/**
 * Valid derived components from RFC 9421 Section 2.2
 */
export const VALID_DERIVED_COMPONENTS = [
    '@method',
    '@target-uri',
    '@authority',
    '@scheme',
    '@request-target',
    '@path',
    '@query',
    '@query-param',
    '@status',
] as const

/**
 * Default components for GET requests (no body)
 * Per AAuth HTTPSig profile (Section 10.3)
 */
export const DEFAULT_COMPONENTS_GET = [
    '@method',
    '@authority',
    '@path',
    'signature-key',
] as const

/**
 * Default components for requests with a body (POST, PUT, PATCH, etc.)
 * Per AAuth HTTPSig profile (Section 10.3)
 */
export const DEFAULT_COMPONENTS_BODY = [
    '@method',
    '@authority',
    '@path',
    'content-type',
    'content-digest',
    'signature-key',
] as const

export type SignatureKeyType =
    | { type: 'hwk' }
    | { type: 'jwt'; jwt: string }
    | { type: 'jwks'; id: string; kid: string; wellKnown?: string }
// Note: x509 scheme support can be added in the future
// | { type: 'x509'; cert: string }
// Recommended implementation: use @peculiar/x509 for certificate parsing
// See: https://github.com/PeculiarVentures/x509

export interface HttpSigFetchOptions extends RequestInit {
    // Required: Private key as JWK
    signingKey: JsonWebKey

    // Required: Signature-Key header configuration
    signatureKey: SignatureKeyType

    // Optional parameters
    label?: string // Signature label (default: 'sig')
    components?: string[] // Override default components

    // Testing mode
    dryRun?: boolean // Return headers without fetching (still returns Promise)
}

export interface VerifyRequest {
    method: string
    authority: string // Required: canonical authority to validate against (per AAuth Section 10.3.1)
    path: string // Request path (e.g., '/data')
    query?: string // Optional query string without leading '?' (e.g., 'foo=bar&baz=qux')
    headers: Headers | Record<string, string | string[]>
    body?: string | Buffer | Uint8Array
}

export interface VerifyOptions {
    // Timestamp validation
    maxClockSkew?: number // Max clock skew in seconds (default: 60)

    // JWKS caching
    jwksCacheTtl?: number // JWKS cache TTL in ms (default: 3600000)

    // AAuth profile enforcement
    strictAAuth?: boolean // Enforce AAuth profile requirements (default: true)
    // When true, requires signature-key in covered components
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
export type SignatureAlgorithm = 'Ed25519' | 'ES256'

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

import type { JWK, KeyLike } from 'jose'

/**
 * Key resolver callback for verification functions
 * @param kid - Key identifier from JWT header
 * @param issuer - Issuer identifier from JWT payload
 * @returns Promise resolving to JWK, KeyLike, or Uint8Array for verification
 */
export type KeyResolver = (
    kid?: string,
    issuer?: string,
) => Promise<JWK | KeyLike | Uint8Array>

/**
 * RequestToken payload structure (step 3.4)
 * Used by browsers to request verified email tokens from issuers
 */
export interface RequestTokenPayload {
    /** Audience (issuer domain) */
    aud: string
    /** Issued at time (optional for testing expired tokens) */
    iat?: number
    /** Unique identifier for the token */
    jti?: string
    /** Nonce provided by the RP */
    nonce: string
    /** Email address to be verified */
    email: string
}

/**
 * IssuanceToken (SD-JWT) payload structure (step 4.2)
 * Used by issuers to provide verified email tokens to browsers
 */
export interface IssuanceTokenPayload {
    /** Issuer identifier */
    iss: string
    /** Issued at time (optional for testing expired tokens) */
    iat?: number
    /** Confirmation claim containing browser's public key */
    cnf: {
        /** JSON Web Key (only essential public key parameters) */
        jwk: JWK
    }
    /** Verified email address */
    email: string
    /** Email verification status (must be true) */
    email_verified: boolean
}

/**
 * PresentationToken payload structure (step 5.2)
 * Contains both SD-JWT and KB-JWT payloads
 */
export interface PresentationTokenPayload {
    /** Verified SD-JWT payload */
    sdJwt: IssuanceTokenPayload
    /** Key Binding JWT payload */
    kbJwt: {
        /** Audience (RP's origin) */
        aud: string
        /** Nonce from original navigator.credentials.get() call */
        nonce: string
        /** Issued at time (optional for testing expired tokens) */
        iat?: number
        /** SHA-256 hash of the SD-JWT (calculated automatically if not provided) */
        sd_hash?: string
    }
}

/**
 * Token generation options
 */
export interface TokenGenerationOptions {
    /** Signing algorithm (default: extracted from JWK) */
    algorithm?: string
    /** Token expiration time in seconds (default: 60) */
    expiresIn?: number
}

/**
 * JWT Header structure for RequestToken
 */
export interface RequestTokenHeader {
    /** Algorithm */
    alg: string
    /** Token type */
    typ: string
    /** Embedded public key */
    jwk: JWK
}

/**
 * JWT Header structure for IssuanceToken (SD-JWT)
 */
export interface IssuanceTokenHeader {
    /** Algorithm */
    alg: string
    /** Token type (evp+sd-jwt) */
    typ: string
    /** Key identifier */
    kid: string
}

/**
 * JWT Header structure for Key Binding JWT
 */
export interface KeyBindingHeader {
    /** Algorithm */
    alg: string
    /** Token type (kb+jwt) */
    typ: string
}

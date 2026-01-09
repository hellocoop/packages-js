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
 * Issuance request body structure
 * Used by browsers to request verified email tokens from issuers via HTTP Message Signature
 */
export interface IssuanceRequestBody {
    /** Email address to be verified */
    email: string
    /** Request a disposable (site-specific) email address */
    disposable?: boolean
    /** Previously issued disposable email to reuse */
    directed_email?: string
}

/**
 * Verified issuance request result
 * Returned after successfully verifying an HTTP Message Signature on an issuance request
 */
export interface VerifiedIssuanceRequest {
    /** Email address from the request body */
    email: string
    /** Browser's public key extracted from the Signature-Key header */
    publicKey: JWK
    /** JWK thumbprint of the public key */
    thumbprint: string
    /** Whether a disposable email was requested */
    disposable?: boolean
    /** Previously issued disposable email to reuse */
    directed_email?: string
}

/**
 * Error response structure per specification
 */
export interface ErrorResponse {
    /** Error code */
    error: string
    /** Human-readable error description */
    error_description: string
}

/**
 * Error codes for issuance endpoint
 */
export type IssuanceErrorCode =
    | 'invalid_signature'
    | 'authentication_required'
    | 'disposable_not_supported'
    | 'invalid_request'

/**
 * IssuanceToken (EVT) payload structure
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
    /** Whether the email is a private/disposable email (optional) */
    is_private_email?: boolean
}

/**
 * Issuance endpoint response structure
 */
export interface IssuanceResponse {
    /** The issued email verification token */
    issuance_token: string
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
 * JWT Header structure for IssuanceToken (EVT)
 */
export interface IssuanceTokenHeader {
    /** Algorithm */
    alg: string
    /** Token type (evt+jwt) */
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

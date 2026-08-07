/**
 * @fileoverview Web Identity Package - JWT token generation and verification for Verified Email Autocomplete
 *
 * This package provides TypeScript functions for generating and verifying JWT tokens used in the
 * Verified Email Autocomplete protocol as defined in the web-identity specification.
 *
 * @author Hello Identity Co-op
 * @version 1.0.0
 * @license MIT
 */

// Export all token functions
export {
    generateRequestToken,
    verifyRequestToken,
} from './tokens/request-token.js'

export {
    generateIssuanceToken,
    verifyIssuanceToken,
} from './tokens/issuance-token.js'

export {
    generatePresentationToken,
    verifyPresentationToken,
} from './tokens/presentation-token.js'

// Export all types
export type {
    KeyResolver,
    RequestTokenPayload,
    IssuanceTokenPayload,
    PresentationTokenPayload,
    TokenGenerationOptions,
    RequestTokenHeader,
    IssuanceTokenHeader,
    KeyBindingHeader,
} from './types.js'

// Export all error classes
export {
    WebIdentityError,
    MissingClaimError,
    InvalidSignatureError,
    TimeValidationError,
    TokenFormatError,
    JWKValidationError,
    EmailValidationError,
    DNSDiscoveryError,
    JWKSFetchError,
} from './errors.js'

// Export utility functions that might be useful for consumers
export {
    validateJWK,
    extractPublicKeyParameters,
    calculateSHA256Hash,
    isValidEmail,
} from './utils/crypto.js'

export {
    getCurrentTimestamp,
    validateIatClaim,
    TIME_VALIDATION_WINDOW,
} from './utils/time.js'

export {
    parseJWT,
    validateRequiredClaims,
    validateEmailClaim,
    validateEmailVerifiedClaim,
    parsePresentationToken,
} from './utils/validation.js'

// Export DNS discovery functions
export {
    discoverIssuer,
    fetchWebIdentityMetadata,
    fetchJWKS,
    clearCaches,
} from './utils/dns-discovery.js'

export type {
    WebIdentityMetadata,
    JWKSResponse,
    RequestOptions,
} from './utils/dns-discovery.js'

import type { JWK } from 'jose'
import { JWKValidationError } from '../errors.js'
import { createHash } from 'crypto'

/**
 * Validates that a JWK contains required fields for the specified algorithm
 * @param jwk - JSON Web Key to validate
 * @returns void (throws on validation failure)
 */
export function validateJWK(jwk: JWK): void {
    if (!jwk.alg) {
        throw new JWKValidationError('JWK must contain "alg" field')
    }

    if (!jwk.kid) {
        throw new JWKValidationError('JWK must contain "kid" field')
    }

    if (!jwk.kty) {
        throw new JWKValidationError('JWK must contain "kty" field')
    }

    // Validate algorithm-specific parameters
    switch (jwk.kty) {
        case 'RSA':
            validateRSAKey(jwk)
            break
        case 'EC':
            validateECKey(jwk)
            break
        case 'OKP':
            validateOKPKey(jwk)
            break
        default:
            throw new JWKValidationError(`Unsupported key type: ${jwk.kty}`)
    }
}

/**
 * Validates RSA key parameters
 */
function validateRSAKey(jwk: JWK): void {
    if (!jwk.n) {
        throw new JWKValidationError('RSA key must contain "n" parameter')
    }
    if (!jwk.e) {
        throw new JWKValidationError('RSA key must contain "e" parameter')
    }
}

/**
 * Validates Elliptic Curve key parameters
 */
function validateECKey(jwk: JWK): void {
    if (!jwk.crv) {
        throw new JWKValidationError('EC key must contain "crv" parameter')
    }
    if (!jwk.x) {
        throw new JWKValidationError('EC key must contain "x" parameter')
    }
    if (!jwk.y) {
        throw new JWKValidationError('EC key must contain "y" parameter')
    }
}

/**
 * Validates Octet Key Pair parameters (EdDSA)
 */
function validateOKPKey(jwk: JWK): void {
    if (!jwk.crv) {
        throw new JWKValidationError('OKP key must contain "crv" parameter')
    }
    if (!jwk.x) {
        throw new JWKValidationError('OKP key must contain "x" parameter')
    }

    // Validate supported curves
    if (
        jwk.crv !== 'Ed25519' &&
        jwk.crv !== 'Ed448' &&
        jwk.crv !== 'X25519' &&
        jwk.crv !== 'X448'
    ) {
        throw new JWKValidationError(`Unsupported OKP curve: ${jwk.crv}`)
    }
}

/**
 * Extracts only the public key parameters from a JWK for inclusion in cnf claims
 * Removes private key material (d parameter) and other sensitive information
 * @param jwk - Source JWK (may contain private key)
 * @returns JWK with only public key parameters
 */
export function extractPublicKeyParameters(jwk: JWK): JWK {
    const publicJwk: JWK = {
        kty: jwk.kty,
        alg: jwk.alg,
        kid: jwk.kid,
    }

    switch (jwk.kty) {
        case 'RSA':
            publicJwk.n = jwk.n
            publicJwk.e = jwk.e
            break
        case 'EC':
            publicJwk.crv = jwk.crv
            publicJwk.x = jwk.x
            publicJwk.y = jwk.y
            break
        case 'OKP':
            publicJwk.crv = jwk.crv
            publicJwk.x = jwk.x
            break
    }

    return publicJwk
}

/**
 * Calculates SHA-256 hash of a string
 * @param input - String to hash
 * @returns Base64url-encoded hash
 */
export function calculateSHA256Hash(input: string): string {
    const hash = createHash('sha256')
    hash.update(input)
    return hash.digest('base64url')
}

/**
 * Validates email address syntax
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return false
    }

    // Security checks for malicious content
    const maliciousPatterns = [
        /<[^>]*>/, // HTML tags
        /[\r\n]/, // Line breaks (CRLF injection)
        /\0/, // Null bytes
        /\.\./, // Path traversal
        /javascript:/i, // JavaScript protocol
        /data:/i, // Data protocol
        /vbscript:/i, // VBScript protocol
        /%[0-9a-f]{2}/i, // URL encoding (potential bypass)
    ]

    for (const pattern of maliciousPatterns) {
        if (pattern.test(email)) {
            return false
        }
    }

    // Length checks
    if (email.length > 254) {
        // RFC 5321 limit
        return false
    }

    const [localPart, domainPart] = email.split('@')
    if (localPart.length > 64 || domainPart.length > 253) {
        // RFC 5321 limits
        return false
    }

    return true
}

import { decodeJwt, decodeProtectedHeader } from 'jose'
import {
    TokenFormatError,
    MissingClaimError,
    EmailValidationError,
} from '../errors.js'
import { isValidEmail } from './crypto.js'

/**
 * Parses a JWT and returns its header and payload
 * @param token - JWT string to parse
 * @returns Object containing decoded header and payload
 * @throws TokenFormatError if JWT format is invalid
 */
export function parseJWT(token: string): { header: any; payload: any } {
    try {
        const header = decodeProtectedHeader(token)
        const payload = decodeJwt(token)

        return { header, payload }
    } catch (error) {
        throw new TokenFormatError(
            `Invalid JWT format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

/**
 * Validates that all required claims are present in a payload
 * @param payload - JWT payload to validate
 * @param requiredClaims - Array of required claim names
 * @throws MissingClaimError if any required claim is missing
 */
export function validateRequiredClaims(
    payload: any,
    requiredClaims: string[],
): void {
    for (const claim of requiredClaims) {
        if (payload[claim] === undefined || payload[claim] === null) {
            throw new MissingClaimError(claim)
        }
    }
}

/**
 * Validates email claim in JWT payload
 * @param payload - JWT payload containing email claim
 * @throws MissingClaimError if email claim is missing
 * @throws EmailValidationError if email format is invalid
 */
export function validateEmailClaim(payload: any): void {
    if (!payload.email) {
        throw new MissingClaimError('email')
    }

    if (!isValidEmail(payload.email)) {
        throw new EmailValidationError(`Invalid email format: ${payload.email}`)
    }
}

/**
 * Validates email_verified claim in JWT payload
 * @param payload - JWT payload containing email_verified claim
 * @throws MissingClaimError if email_verified claim is missing
 * @throws EmailValidationError if email_verified is not true
 */
export function validateEmailVerifiedClaim(payload: any): void {
    if (
        payload.email_verified === undefined ||
        payload.email_verified === null
    ) {
        throw new MissingClaimError('email_verified')
    }

    if (payload.email_verified !== true) {
        throw new EmailValidationError('email_verified claim must be true')
    }
}

/**
 * Validates JWT header contains required fields
 * @param header - JWT header to validate
 * @param requiredFields - Array of required header field names
 * @throws TokenFormatError if any required field is missing
 */
export function validateJWTHeader(header: any, requiredFields: string[]): void {
    for (const field of requiredFields) {
        if (header[field] === undefined || header[field] === null) {
            throw new TokenFormatError(
                `JWT header is missing required field: ${field}`,
            )
        }
    }
}

/**
 * Validates that JWT type matches expected value
 * @param header - JWT header containing typ field
 * @param expectedType - Expected token type
 * @throws TokenFormatError if type doesn't match
 */
export function validateJWTType(header: any, expectedType: string): void {
    if (header.typ !== expectedType) {
        throw new TokenFormatError(
            `Expected JWT type '${expectedType}', got '${header.typ}'`,
        )
    }
}

/**
 * Parses SD-JWT+KB token by splitting on tilde separator
 * @param token - SD-JWT+KB token string
 * @returns Object containing SD-JWT and KB-JWT parts
 * @throws TokenFormatError if format is invalid
 */
export function parsePresentationToken(token: string): {
    sdJwt: string
    kbJwt: string
} {
    const parts = token.split('~')

    if (parts.length !== 2) {
        throw new TokenFormatError(
            'PresentationToken must contain exactly one tilde separator',
        )
    }

    const [sdJwt, kbJwt] = parts

    if (!sdJwt || !kbJwt) {
        throw new TokenFormatError('PresentationToken parts cannot be empty')
    }

    return { sdJwt, kbJwt }
}

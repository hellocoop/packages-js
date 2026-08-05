/**
 * Typed verification errors
 *
 * Verification failures carry the Signature-Error code the server should
 * report, rather than leaving it to be recovered by matching on message text.
 */

import { SignatureErrorCode } from './types.js'

export interface SignatureVerificationErrorOptions {
    /** Covered components the server requires, for invalid_input. */
    requiredInput?: string[]
    /**
     * Algorithms the verifier accepts, for unsupported_algorithm. Sent as
     * Accept-Signature-Alg -- NOT as a Signature-Error member, since the
     * supported_algorithms member was removed in -08.
     */
    supportedAlgorithms?: string[]
    cause?: unknown
}

export class SignatureVerificationError extends Error {
    readonly code: SignatureErrorCode
    readonly requiredInput?: string[]
    readonly supportedAlgorithms?: string[]

    constructor(
        code: SignatureErrorCode,
        message: string,
        options: SignatureVerificationErrorOptions = {},
    ) {
        super(message, { cause: options.cause })
        this.name = 'SignatureVerificationError'
        this.code = code
        this.requiredInput = options.requiredInput
        this.supportedAlgorithms = options.supportedAlgorithms
    }
}

/** The key material is malformed, or forbidden by the specification. */
export function invalidKey(message: string): SignatureVerificationError {
    return new SignatureVerificationError('invalid_key', message)
}

/**
 * The algorithm is well formed but this verifier will not use it -- either
 * unimplemented, or outside the accepted set.
 */
export function unsupportedAlgorithm(
    message: string,
    supportedAlgorithms?: string[],
): SignatureVerificationError {
    return new SignatureVerificationError('unsupported_algorithm', message, {
        supportedAlgorithms,
    })
}

/** The Signature-Key scheme is not one this implementation understands. */
export function unsupportedScheme(message: string): SignatureVerificationError {
    return new SignatureVerificationError('unsupported_scheme', message)
}

/** The assertion is malformed. */
export function invalidJwt(message: string): SignatureVerificationError {
    return new SignatureVerificationError('invalid_jwt', message)
}

/** The discovery metadata document has no issuer member. */
export function issuerMissing(message: string): SignatureVerificationError {
    return new SignatureVerificationError('issuer_missing', message)
}

/**
 * The metadata document's issuer does not match the identity it was fetched
 * under. Binds the document to that identity, so a document served under one
 * origin cannot point jwks_uri at another's keys.
 */
export function issuerMismatch(message: string): SignatureVerificationError {
    return new SignatureVerificationError('issuer_mismatch', message)
}

/** The assertion is well formed but no longer valid. */
export function expiredJwt(message: string): SignatureVerificationError {
    return new SignatureVerificationError('expired_jwt', message)
}

/** The covered components are missing something the verifier requires. */
export function invalidInput(
    message: string,
    requiredInput?: string[],
): SignatureVerificationError {
    return new SignatureVerificationError('invalid_input', message, {
        requiredInput,
    })
}

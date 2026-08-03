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
    cause?: unknown
}

export class SignatureVerificationError extends Error {
    readonly code: SignatureErrorCode
    readonly requiredInput?: string[]

    constructor(
        code: SignatureErrorCode,
        message: string,
        options: SignatureVerificationErrorOptions = {},
    ) {
        super(message, { cause: options.cause })
        this.name = 'SignatureVerificationError'
        this.code = code
        this.requiredInput = options.requiredInput
    }
}

/** The key material is malformed, or forbidden by the specification. */
export function invalidKey(message: string): SignatureVerificationError {
    return new SignatureVerificationError('invalid_key', message)
}

/** The algorithm is well formed but this implementation cannot use it. */
export function unsupportedAlgorithm(
    message: string,
): SignatureVerificationError {
    return new SignatureVerificationError('unsupported_algorithm', message)
}

/** The Signature-Key scheme is not one this implementation understands. */
export function unsupportedScheme(message: string): SignatureVerificationError {
    return new SignatureVerificationError('unsupported_scheme', message)
}

/** The assertion is malformed. */
export function invalidJwt(message: string): SignatureVerificationError {
    return new SignatureVerificationError('invalid_jwt', message)
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

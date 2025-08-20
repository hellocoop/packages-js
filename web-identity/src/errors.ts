/**
 * Base error class for all web-identity related errors
 */
export class WebIdentityError extends Error {
    constructor(
        message: string,
        public code: string,
    ) {
        super(message)
        this.name = 'WebIdentityError'

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, WebIdentityError)
        }
    }
}

/**
 * Error thrown when a required claim is missing from a JWT
 */
export class MissingClaimError extends WebIdentityError {
    constructor(claim: string) {
        super(`Required claim '${claim}' is missing`, 'missing_claim')
        this.name = 'MissingClaimError'
    }
}

/**
 * Error thrown when JWT signature verification fails
 */
export class InvalidSignatureError extends WebIdentityError {
    constructor(message: string = 'Token signature verification failed') {
        super(message, 'invalid_signature')
        this.name = 'InvalidSignatureError'
    }
}

/**
 * Error thrown when time-based validation fails (iat claims)
 */
export class TimeValidationError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'time_validation')
        this.name = 'TimeValidationError'
    }
}

/**
 * Error thrown when token format is invalid or malformed
 */
export class TokenFormatError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'token_format')
        this.name = 'TokenFormatError'
    }
}

/**
 * Error thrown when JWK validation fails
 */
export class JWKValidationError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'jwk_validation')
        this.name = 'JWKValidationError'
    }
}

/**
 * Error thrown when email validation fails
 */
export class EmailValidationError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'email_validation')
        this.name = 'EmailValidationError'
    }
}

/**
 * Error thrown when DNS discovery fails
 */
export class DNSDiscoveryError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'dns_discovery')
        this.name = 'DNSDiscoveryError'
    }
}

/**
 * Error thrown when JWKS fetching fails
 */
export class JWKSFetchError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'jwks_fetch')
        this.name = 'JWKSFetchError'
    }
}

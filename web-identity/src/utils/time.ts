import { TimeValidationError } from '../errors.js'

/**
 * Time window for iat validation in seconds (60 seconds as per spec)
 */
export const TIME_VALIDATION_WINDOW = 60

/**
 * Gets current Unix timestamp in seconds
 * @returns Current time as Unix timestamp
 */
export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000)
}

/**
 * Validates that an iat (issued at) claim is within the acceptable time window
 * @param iat - Issued at timestamp from JWT payload
 * @param windowSeconds - Time window in seconds (default: 60)
 * @throws TimeValidationError if iat is outside the acceptable window
 */
export function validateIatClaim(
    iat: number,
    windowSeconds: number = TIME_VALIDATION_WINDOW,
): void {
    const currentTime = getCurrentTimestamp()
    const timeDifference = Math.abs(currentTime - iat)

    if (timeDifference > windowSeconds) {
        throw new TimeValidationError(
            `Token iat claim is outside acceptable time window. ` +
                `Current time: ${currentTime}, Token iat: ${iat}, ` +
                `Difference: ${timeDifference}s, Max allowed: ${windowSeconds}s`,
        )
    }
}

/**
 * Ensures iat claim is present, setting it to current time if not provided
 * @param payload - Token payload that may contain iat
 * @returns Updated payload with iat set to current time if it was missing
 */
export function ensureIatClaim<T extends { iat?: number }>(
    payload: T,
): T & { iat: number } {
    const currentTime = getCurrentTimestamp()

    if (payload.iat !== undefined) {
        // If iat is provided, use it as-is (allows testing with expired tokens)
        return { ...payload, iat: payload.iat }
    }

    // If iat is not provided, set it to current time
    return { ...payload, iat: currentTime }
}

/**
 * Validates iat claim during token verification
 * @param iat - Issued at timestamp from JWT payload
 * @param windowSeconds - Time window in seconds (default: 60)
 * @throws TimeValidationError if iat is missing or outside acceptable window
 */
export function validateIatForVerification(
    iat: number | undefined,
    windowSeconds: number = TIME_VALIDATION_WINDOW,
): void {
    if (iat === undefined) {
        throw new TimeValidationError('Token is missing required iat claim')
    }

    validateIatClaim(iat, windowSeconds)
}

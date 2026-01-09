import { SignJWT, importJWK, jwtVerify } from 'jose'
import type { JWK } from 'jose'
import type {
    IssuanceTokenPayload,
    TokenGenerationOptions,
    KeyResolver,
} from '../types.js'
import { validateJWK, extractPublicKeyParameters } from '../utils/crypto.js'
import { ensureIatClaim, validateIatForVerification } from '../utils/time.js'
import {
    parseJWT,
    validateRequiredClaims,
    validateEmailClaim,
    validateEmailVerifiedClaim,
    validateJWTType,
} from '../utils/validation.js'
import { InvalidSignatureError } from '../errors.js'

/**
 * Generates an IssuanceToken (EVT) for verified email addresses
 * Used by issuers in the email-verification protocol
 *
 * @param payload - IssuanceToken payload containing iss, cnf, email, email_verified, and optional iat, is_private_email
 * @param jwk - JWK containing private key, alg, and kid
 * @param options - Optional token generation options
 * @returns Promise resolving to signed EVT string
 */
export async function generateIssuanceToken(
    payload: IssuanceTokenPayload,
    jwk: JWK,
    options?: TokenGenerationOptions,
): Promise<string> {
    // Validate the JWK
    validateJWK(jwk)

    // Validate email format
    validateEmailClaim(payload)

    // Validate email_verified claim
    validateEmailVerifiedClaim(payload)

    // Ensure iat is set (current time if not provided)
    const payloadWithIat = ensureIatClaim(payload)

    // Extract algorithm from JWK
    const algorithm = options?.algorithm || jwk.alg
    if (!algorithm) {
        throw new Error('Algorithm must be specified in JWK or options')
    }

    // Import the private key
    const privateKey = await importJWK(jwk, algorithm)

    // Ensure cnf.jwk contains only public key parameters
    const cleanedPayload = {
        ...payloadWithIat,
        cnf: {
            jwk: extractPublicKeyParameters(payloadWithIat.cnf.jwk),
        },
    }

    // Create and sign the EVT
    const jwt = await new SignJWT(cleanedPayload)
        .setProtectedHeader({
            alg: algorithm,
            typ: 'evt+jwt',
            kid: jwk.kid,
        })
        .sign(privateKey)

    return jwt
}

/**
 * Verifies an IssuanceToken (EVT) from issuers
 * Used by browsers in the email-verification protocol
 *
 * @param token - EVT string to verify
 * @param keyResolver - Callback to resolve issuer's public key using kid
 * @returns Promise resolving to verified payload
 */
export async function verifyIssuanceToken(
    token: string,
    keyResolver: KeyResolver,
): Promise<IssuanceTokenPayload> {
    // Parse the JWT
    const { header, payload } = parseJWT(token)

    // Validate JWT type
    validateJWTType(header, 'evt+jwt')

    // Validate required header fields
    if (!header.kid) {
        throw new InvalidSignatureError(
            'IssuanceToken header must contain key identifier (kid)',
        )
    }

    if (!header.alg) {
        throw new InvalidSignatureError(
            'IssuanceToken header must contain algorithm (alg)',
        )
    }

    // Validate required payload claims
    validateRequiredClaims(payload, ['iss', 'cnf', 'email', 'email_verified'])

    // Validate email format
    validateEmailClaim(payload)

    // Validate email_verified claim
    validateEmailVerifiedClaim(payload)

    // Validate iat claim
    validateIatForVerification(payload.iat)

    // Validate cnf claim structure
    if (!payload.cnf || !payload.cnf.jwk) {
        throw new InvalidSignatureError(
            'IssuanceToken must contain cnf.jwk claim',
        )
    }

    // Resolve the issuer's public key
    const publicKey = await keyResolver(header.kid, payload.iss)

    // Verify the JWT signature
    try {
        const { payload: verifiedPayload } = await jwtVerify(token, publicKey, {
            algorithms: [header.alg],
        })

        return verifiedPayload as unknown as IssuanceTokenPayload
    } catch (error) {
        throw new InvalidSignatureError(
            `IssuanceToken signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

import { SignJWT, importJWK } from 'jose'
import type { JWK } from 'jose'
import type { RequestTokenPayload, TokenGenerationOptions } from '../types.js'
import { validateJWK, extractPublicKeyParameters } from '../utils/crypto.js'
import { ensureIatClaim, validateIatForVerification } from '../utils/time.js'
import {
    parseJWT,
    validateRequiredClaims,
    validateEmailClaim,
} from '../utils/validation.js'
import { InvalidSignatureError } from '../errors.js'

/**
 * Generates a RequestToken (JWT) for requesting verified email tokens from issuers
 * Used by browsers in step 3.4 of the web-identity protocol
 *
 * @param payload - RequestToken payload containing aud, nonce, email, and optional iss, iat
 * @param jwk - JWK containing private key, alg, and kid
 * @param options - Optional token generation options
 * @returns Promise resolving to signed JWT string
 */
export async function generateRequestToken(
    payload: RequestTokenPayload,
    jwk: JWK,
    options?: TokenGenerationOptions,
): Promise<string> {
    // Validate the JWK
    validateJWK(jwk)

    // Validate email format
    validateEmailClaim(payload)

    // Ensure iat is set (current time if not provided)
    const payloadWithIat = ensureIatClaim(payload)

    // Extract algorithm from JWK
    const algorithm = options?.algorithm || jwk.alg
    if (!algorithm) {
        throw new Error('Algorithm must be specified in JWK or options')
    }

    // Import the private key
    const privateKey = await importJWK(jwk, algorithm)

    // Extract public key parameters for header
    const publicKeyForHeader = extractPublicKeyParameters(jwk)

    // Create and sign the JWT
    const jwt = await new SignJWT(payloadWithIat as any)
        .setProtectedHeader({
            alg: algorithm,
            typ: 'JWT',
            jwk: publicKeyForHeader,
            kid: jwk.kid,
        })
        .sign(privateKey)

    return jwt
}

/**
 * Verifies a RequestToken (JWT) from browsers
 * Used by issuers in step 4.1 of the web-identity protocol
 *
 * @param token - JWT string to verify
 * @returns Promise resolving to verified payload
 */
export async function verifyRequestToken(
    token: string,
): Promise<RequestTokenPayload> {
    // Parse the JWT
    const { header, payload } = parseJWT(token)

    // Validate required header fields
    if (!header.jwk) {
        throw new InvalidSignatureError(
            'RequestToken header must contain embedded public key (jwk)',
        )
    }

    if (!header.alg) {
        throw new InvalidSignatureError(
            'RequestToken header must contain algorithm (alg)',
        )
    }

    // Validate required payload claims
    validateRequiredClaims(payload, ['aud', 'nonce', 'email'])

    // Validate email format
    validateEmailClaim(payload)

    // Validate iat claim
    validateIatForVerification(payload.iat)

    // Import the public key from header
    const publicKey = await importJWK(header.jwk, header.alg)

    // Verify the JWT signature using jose's jwtVerify
    try {
        const { jwtVerify } = await import('jose')
        const { payload: verifiedPayload } = await jwtVerify(token, publicKey, {
            algorithms: [header.alg],
        })

        return verifiedPayload as unknown as RequestTokenPayload
    } catch (error) {
        throw new InvalidSignatureError(
            `RequestToken signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

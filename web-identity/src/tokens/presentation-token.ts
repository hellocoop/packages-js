import { SignJWT, importJWK, jwtVerify } from 'jose'
import type { JWK } from 'jose'
import type {
    PresentationTokenPayload,
    TokenGenerationOptions,
    KeyResolver,
} from '../types.js'
import { validateJWK, calculateSHA256Hash } from '../utils/crypto.js'
import { ensureIatClaim, validateIatForVerification } from '../utils/time.js'
import {
    parseJWT,
    validateRequiredClaims,
    parsePresentationToken,
    validateJWTType,
} from '../utils/validation.js'
import { verifyIssuanceToken } from './issuance-token.js'
import { InvalidSignatureError, TokenFormatError } from '../errors.js'

/**
 * Generates a PresentationToken (SD-JWT+KB) for presenting verified email tokens to relying parties
 * Used by browsers in step 5.2 of the web-identity protocol
 *
 * @param sdJwt - SD-JWT string from issuer
 * @param audience - RP's origin
 * @param nonce - Nonce from original navigator.credentials.get() call
 * @param jwk - JWK containing browser's private key, alg, and kid
 * @param options - Optional token generation options
 * @returns Promise resolving to SD-JWT+KB string (SD-JWT~KB-JWT)
 */
export async function generatePresentationToken(
    sdJwt: string,
    audience: string,
    nonce: string,
    jwk: JWK,
    options?: TokenGenerationOptions,
): Promise<string> {
    // Validate the JWK
    validateJWK(jwk)

    // Validate the SD-JWT format
    if (!sdJwt || typeof sdJwt !== 'string') {
        throw new TokenFormatError('SD-JWT must be a non-empty string')
    }

    // Calculate SHA-256 hash of the SD-JWT
    const sdHash = calculateSHA256Hash(sdJwt)

    // Create KB-JWT payload
    const kbJwtPayload = {
        aud: audience,
        nonce: nonce,
        sd_hash: sdHash,
        iat: undefined as number | undefined,
    }

    // Ensure iat is set (current time if not provided)
    const kbJwtPayloadWithIat = ensureIatClaim(kbJwtPayload)

    // Extract algorithm from JWK
    const algorithm = options?.algorithm || jwk.alg
    if (!algorithm) {
        throw new Error('Algorithm must be specified in JWK or options')
    }

    // Import the private key
    const privateKey = await importJWK(jwk, algorithm)

    // Create and sign the KB-JWT
    const kbJwt = await new SignJWT(kbJwtPayloadWithIat)
        .setProtectedHeader({
            alg: algorithm,
            typ: 'kb+jwt',
        })
        .sign(privateKey)

    // Concatenate SD-JWT and KB-JWT with tilde separator
    return `${sdJwt}~${kbJwt}`
}

/**
 * Verifies a PresentationToken (SD-JWT+KB) from browsers
 * Used by relying parties in steps 6.2-6.4 of the web-identity protocol
 *
 * @param token - SD-JWT+KB string to verify
 * @param keyResolver - Callback to resolve issuer's public key for SD-JWT verification
 * @param expectedAudience - Expected audience (RP's origin)
 * @param expectedNonce - Expected nonce from RP's session
 * @returns Promise resolving to both SD-JWT and KB-JWT verified payloads
 */
export async function verifyPresentationToken(
    token: string,
    keyResolver: KeyResolver,
    expectedAudience: string,
    expectedNonce: string,
): Promise<PresentationTokenPayload> {
    // Parse SD-JWT+KB by splitting on tilde separator
    const { sdJwt, kbJwt } = parsePresentationToken(token)

    // First verify the SD-JWT using the existing verifyIssuanceToken function
    const sdJwtPayload = await verifyIssuanceToken(sdJwt, keyResolver)

    // Parse the KB-JWT
    const { header: kbHeader, payload: kbPayload } = parseJWT(kbJwt)

    // Validate KB-JWT type
    validateJWTType(kbHeader, 'kb+jwt')

    // Validate required KB-JWT header fields
    if (!kbHeader.alg) {
        throw new InvalidSignatureError(
            'KB-JWT header must contain algorithm (alg)',
        )
    }

    // Validate required KB-JWT payload claims
    validateRequiredClaims(kbPayload, ['aud', 'nonce', 'iat', 'sd_hash'])

    // Validate KB-JWT claims
    if (kbPayload.aud !== expectedAudience) {
        throw new InvalidSignatureError(
            `KB-JWT audience mismatch. Expected: ${expectedAudience}, Got: ${kbPayload.aud}`,
        )
    }

    if (kbPayload.nonce !== expectedNonce) {
        throw new InvalidSignatureError(
            `KB-JWT nonce mismatch. Expected: ${expectedNonce}, Got: ${kbPayload.nonce}`,
        )
    }

    // Validate iat claim
    validateIatForVerification(kbPayload.iat)

    // Verify sd_hash matches SHA-256 hash of SD-JWT
    const expectedSdHash = calculateSHA256Hash(sdJwt)
    if (kbPayload.sd_hash !== expectedSdHash) {
        throw new InvalidSignatureError(
            `KB-JWT sd_hash mismatch. Expected: ${expectedSdHash}, Got: ${kbPayload.sd_hash}`,
        )
    }

    // Extract the public key from SD-JWT's cnf claim for KB-JWT verification
    if (!sdJwtPayload.cnf || !sdJwtPayload.cnf.jwk) {
        throw new InvalidSignatureError(
            'SD-JWT must contain cnf.jwk claim for KB-JWT verification',
        )
    }

    const browserPublicKey = await importJWK(sdJwtPayload.cnf.jwk, kbHeader.alg)

    // Verify the KB-JWT signature using the browser's public key from SD-JWT
    try {
        const { payload: verifiedKbPayload } = await jwtVerify(
            kbJwt,
            browserPublicKey,
            {
                algorithms: [kbHeader.alg],
            },
        )

        return {
            sdJwt: sdJwtPayload,
            kbJwt: verifiedKbPayload as any,
        }
    } catch (error) {
        throw new InvalidSignatureError(
            `KB-JWT signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

import { SignJWT, importJWK } from 'jose'
import type { JWK } from 'jose'
import { validateJWK, extractPublicKeyParameters } from '../utils/crypto.js'
import { ensureIatClaim } from '../utils/time.js'

export interface RequestTokenPayload {
    aud: string
    nonce: string
    email: string
    iat?: number
    [key: string]: unknown
}

/**
 * Generates a RequestToken for the email verification protocol.
 * Used by browsers to request email verification from an issuer.
 *
 * The browser's public key is embedded in the JWT header as `jwk`,
 * allowing the issuer to bind the issuance token to this key.
 *
 * @param payload - RequestToken payload containing aud, nonce, email, and optional iat
 * @param jwk - JWK containing private key, alg, and kid
 * @returns Promise resolving to signed RequestToken string
 */
export async function generateRequestToken(
    payload: RequestTokenPayload,
    jwk: JWK,
): Promise<string> {
    validateJWK(jwk)

    const payloadWithIat = ensureIatClaim(payload)

    const algorithm = jwk.alg
    if (!algorithm) {
        throw new Error('Algorithm must be specified in JWK')
    }

    const privateKey = await importJWK(jwk, algorithm)

    const publicJWK = extractPublicKeyParameters(jwk)

    const jwt = await new SignJWT(payloadWithIat)
        .setProtectedHeader({
            alg: algorithm,
            typ: 'JWT',
            jwk: publicJWK,
            kid: jwk.kid,
        })
        .sign(privateKey)

    return jwt
}

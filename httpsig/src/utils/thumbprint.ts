/**
 * JWK Thumbprint calculation per RFC 7638
 * https://datatracker.ietf.org/doc/html/rfc7638
 */

import { sha256, sha512, base64urlEncode } from './base64.js'

/**
 * Calculate JWK thumbprint (RFC 7638)
 *
 * The thumbprint is a stable identifier for a public key, computed as:
 * 1. Extract required members in lexicographic order
 * 2. Create canonical JSON (no whitespace)
 * 3. SHA-256 hash
 * 4. Base64url encode
 *
 * @param jwk - The public key JWK
 * @param hashAlgorithm - Hash algorithm to use: 'SHA-256' (default) or 'SHA-512'
 * @returns Base64url-encoded hash of the canonical JWK
 */
export async function calculateThumbprint(
    jwk: JsonWebKey,
    hashAlgorithm: 'SHA-256' | 'SHA-512' = 'SHA-256',
): Promise<string> {
    // Extract required members based on key type, in lexicographic order
    let canonical: string

    switch (jwk.kty) {
        case 'OKP': {
            // Required: crv, kty, x (in lexicographic order)
            if (!jwk.crv || !jwk.x) {
                throw new Error('OKP key missing required fields (crv, x)')
            }
            canonical = JSON.stringify({
                crv: jwk.crv,
                kty: jwk.kty,
                x: jwk.x,
            })
            break
        }

        case 'EC': {
            // Required: crv, kty, x, y (in lexicographic order)
            if (!jwk.crv || !jwk.x || !jwk.y) {
                throw new Error('EC key missing required fields (crv, x, y)')
            }
            canonical = JSON.stringify({
                crv: jwk.crv,
                kty: jwk.kty,
                x: jwk.x,
                y: jwk.y,
            })
            break
        }

        default:
            // Note: RSA is not supported by this library (Ed25519 and ES256 only)
            throw new Error(`Unsupported key type: ${jwk.kty}`)
    }

    // Hash and encode
    const hashFn = hashAlgorithm === 'SHA-512' ? sha512 : sha256
    const hash = await hashFn(canonical)
    return base64urlEncode(hash)
}

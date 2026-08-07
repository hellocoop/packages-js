import { createVerify, createHash, createPublicKey, KeyObject } from 'crypto'
import { Buffer } from 'buffer'

/**
 * Independent JWT verification using Node.js crypto module
 * This provides verification separate from the jose library to validate our token generation
 */

/**
 * Base64url decode a string
 */
function base64urlDecode(str: string): Buffer {
    // Add padding if needed
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
    // Replace URL-safe characters
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64')
}

/**
 * Base64url encode a buffer
 */
function base64urlEncode(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

/**
 * Parse JWT into components
 */
export function parseJWTIndependent(token: string): {
    header: any
    payload: any
    signature: string
} {
    const parts = token.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
    }

    const [headerPart, payloadPart, signaturePart] = parts

    const header = JSON.parse(base64urlDecode(headerPart).toString('utf8'))
    const payload = JSON.parse(base64urlDecode(payloadPart).toString('utf8'))

    return { header, payload, signature: signaturePart }
}

/**
 * Convert JWK to KeyObject using Node.js crypto
 */
function jwkToKeyObject(jwk: any) {
    return createPublicKey({ key: jwk, format: 'jwk' })
}

/**
 * Verify JWT signature independently using Node.js crypto
 */
export async function verifyJWTSignatureIndependent(
    token: string,
): Promise<{ valid: boolean; header: any; payload: any }> {
    const { header, payload, signature } = parseJWTIndependent(token)

    // Get the signing input (header.payload)
    const parts = token.split('.')
    const signingInput = `${parts[0]}.${parts[1]}`

    let keyObject: KeyObject
    let algorithm: string

    // Convert JWK to KeyObject based on key type
    try {
        keyObject = jwkToKeyObject(header.jwk)

        if (header.jwk.kty === 'RSA') {
            algorithm = 'RSA-SHA256'
        } else if (header.jwk.kty === 'OKP' && header.jwk.crv === 'Ed25519') {
            algorithm = 'ed25519'
        } else {
            throw new Error(`Unsupported key type: ${header.jwk.kty}`)
        }
    } catch (error) {
        throw new Error(
            `Failed to create key object: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }

    // Verify signature
    let valid: boolean
    const signatureBuffer = base64urlDecode(signature)

    if (algorithm === 'ed25519') {
        // For EdDSA, use verify method directly without createVerify
        const { verify } = await import('crypto')
        valid = verify(
            null,
            Buffer.from(signingInput),
            keyObject,
            signatureBuffer,
        )
    } else {
        // For RSA and other algorithms, use createVerify
        const verifier = createVerify(algorithm)
        verifier.update(signingInput)
        valid = verifier.verify(keyObject, signatureBuffer)
    }

    return { valid, header, payload }
}

/**
 * Calculate SHA-256 hash independently
 */
export function calculateSHA256Independent(input: string): string {
    const hash = createHash('sha256')
    hash.update(input)
    return base64urlEncode(hash.digest())
}

/**
 * Verify PresentationToken (SD-JWT+KB) independently
 */
export async function verifyPresentationTokenIndependent(
    token: string,
    issuerPublicKey: any,
    expectedAudience: string,
    expectedNonce: string,
): Promise<{
    valid: boolean
    sdJwtPayload: any
    kbJwtPayload: any
    errors: string[]
}> {
    const errors: string[] = []

    try {
        // Parse SD-JWT+KB by splitting on tilde
        const parts = token.split('~')
        if (parts.length !== 2) {
            errors.push(
                'PresentationToken must contain exactly one tilde separator',
            )
            return {
                valid: false,
                sdJwtPayload: null,
                kbJwtPayload: null,
                errors,
            }
        }

        const [sdJwt, kbJwt] = parts

        if (!sdJwt || !kbJwt) {
            errors.push('PresentationToken parts cannot be empty')
            return {
                valid: false,
                sdJwtPayload: null,
                kbJwtPayload: null,
                errors,
            }
        }

        // Verify SD-JWT independently
        const sdJwtVerification = await verifyIssuanceTokenIndependent(
            sdJwt,
            issuerPublicKey,
        )
        if (!sdJwtVerification.valid) {
            errors.push(...sdJwtVerification.errors.map((e) => `SD-JWT: ${e}`))
        }

        // Parse KB-JWT
        const { header: kbHeader, payload: kbPayload } =
            parseJWTIndependent(kbJwt)

        // Validate KB-JWT header
        if (kbHeader.typ !== 'kb+jwt') {
            errors.push(`Expected KB-JWT typ 'kb+jwt', got '${kbHeader.typ}'`)
        }

        if (!kbHeader.alg) {
            errors.push('Missing alg in KB-JWT header')
        }

        // Validate KB-JWT payload
        const requiredKbClaims = ['aud', 'nonce', 'iat', 'sd_hash']
        for (const claim of requiredKbClaims) {
            if (kbPayload[claim] === undefined) {
                errors.push(`Missing required KB-JWT claim: ${claim}`)
            }
        }

        // Validate KB-JWT claims
        if (kbPayload.aud !== expectedAudience) {
            errors.push(
                `KB-JWT audience mismatch. Expected: ${expectedAudience}, Got: ${kbPayload.aud}`,
            )
        }

        if (kbPayload.nonce !== expectedNonce) {
            errors.push(
                `KB-JWT nonce mismatch. Expected: ${expectedNonce}, Got: ${kbPayload.nonce}`,
            )
        }

        // Validate iat (within 60 seconds)
        if (kbPayload.iat) {
            const currentTime = Math.floor(Date.now() / 1000)
            const timeDiff = Math.abs(currentTime - kbPayload.iat)
            if (timeDiff > 60) {
                errors.push(
                    `KB-JWT iat claim outside acceptable window: ${timeDiff}s`,
                )
            }
        }

        // Verify sd_hash matches SHA-256 hash of SD-JWT
        const expectedSdHash = calculateSHA256Independent(sdJwt)
        if (kbPayload.sd_hash !== expectedSdHash) {
            errors.push(
                `KB-JWT sd_hash mismatch. Expected: ${expectedSdHash}, Got: ${kbPayload.sd_hash}`,
            )
        }

        // Verify KB-JWT signature using browser's public key from SD-JWT cnf claim
        let kbSignatureValid = false
        if (
            sdJwtVerification.valid &&
            sdJwtVerification.payload &&
            sdJwtVerification.payload.cnf &&
            sdJwtVerification.payload.cnf.jwk
        ) {
            try {
                const browserPublicKey = sdJwtVerification.payload.cnf.jwk
                const kbSigningInput = kbJwt.split('.').slice(0, 2).join('.')
                const kbSignature = kbJwt.split('.')[2]

                const keyObject = jwkToKeyObject(browserPublicKey)
                let algorithm: string

                if (browserPublicKey.kty === 'RSA') {
                    algorithm = 'RSA-SHA256'
                } else if (
                    browserPublicKey.kty === 'OKP' &&
                    browserPublicKey.crv === 'Ed25519'
                ) {
                    algorithm = 'ed25519'
                } else {
                    throw new Error(
                        `Unsupported browser key type: ${browserPublicKey.kty}`,
                    )
                }

                const kbSignatureBuffer = base64urlDecode(kbSignature)

                if (algorithm === 'ed25519') {
                    const { verify } = await import('crypto')
                    kbSignatureValid = verify(
                        null,
                        Buffer.from(kbSigningInput),
                        keyObject,
                        kbSignatureBuffer,
                    )
                } else {
                    const verifier = createVerify(algorithm)
                    verifier.update(kbSigningInput)
                    kbSignatureValid = verifier.verify(
                        keyObject,
                        kbSignatureBuffer,
                    )
                }

                if (!kbSignatureValid) {
                    errors.push('Invalid KB-JWT signature')
                }
            } catch (error) {
                errors.push(
                    `KB-JWT signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                )
            }
        } else {
            errors.push(
                'Cannot verify KB-JWT signature: SD-JWT verification failed or missing cnf.jwk',
            )
        }

        const overallValid =
            sdJwtVerification.valid && kbSignatureValid && errors.length === 0

        return {
            valid: overallValid,
            sdJwtPayload: sdJwtVerification.payload,
            kbJwtPayload: kbPayload,
            errors,
        }
    } catch (error) {
        errors.push(
            `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        return { valid: false, sdJwtPayload: null, kbJwtPayload: null, errors }
    }
}

/**
 * Verify RequestToken independently
 */
export async function verifyRequestTokenIndependent(
    token: string,
): Promise<{ valid: boolean; payload: any; errors: string[] }> {
    const errors: string[] = []

    try {
        const { valid, header, payload } =
            await verifyJWTSignatureIndependent(token)

        if (!valid) {
            errors.push('Invalid signature')
        }

        // Validate header
        if (header.typ !== 'JWT') {
            errors.push(`Expected typ 'JWT', got '${header.typ}'`)
        }

        if (!header.jwk) {
            errors.push('Missing jwk in header')
        }

        if (!header.alg) {
            errors.push('Missing alg in header')
        }

        // Validate payload
        const requiredClaims = ['aud', 'iat', 'nonce', 'email']
        for (const claim of requiredClaims) {
            if (payload[claim] === undefined) {
                errors.push(`Missing required claim: ${claim}`)
            }
        }

        // Validate email format
        if (
            payload.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
        ) {
            errors.push('Invalid email format')
        }

        // Validate iat (within 60 seconds)
        if (payload.iat) {
            const currentTime = Math.floor(Date.now() / 1000)
            const timeDiff = Math.abs(currentTime - payload.iat)
            if (timeDiff > 60) {
                errors.push(`iat claim outside acceptable window: ${timeDiff}s`)
            }
        }

        return { valid: valid && errors.length === 0, payload, errors }
    } catch (error) {
        errors.push(
            `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        return { valid: false, payload: null, errors }
    }
}

/**
 * Verify IssuanceToken (SD-JWT) independently using external key
 */
export async function verifyIssuanceTokenIndependent(
    token: string,
    issuerPublicKey: any,
): Promise<{ valid: boolean; payload: any; errors: string[] }> {
    const errors: string[] = []

    try {
        const { header, payload } = parseJWTIndependent(token)

        // Validate header
        if (header.typ !== 'web-identity+sd-jwt') {
            errors.push(
                `Expected typ 'web-identity+sd-jwt', got '${header.typ}'`,
            )
        }

        if (!header.kid) {
            errors.push('Missing kid in header')
        }

        if (!header.alg) {
            errors.push('Missing alg in header')
        }

        // Validate payload
        const requiredClaims = ['iss', 'iat', 'cnf', 'email', 'email_verified']
        for (const claim of requiredClaims) {
            if (payload[claim] === undefined) {
                errors.push(`Missing required claim: ${claim}`)
            }
        }

        // Validate email format
        if (
            payload.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
        ) {
            errors.push('Invalid email format')
        }

        // Validate email_verified
        if (payload.email_verified !== true) {
            errors.push('email_verified must be true')
        }

        // Validate cnf claim structure
        if (!payload.cnf || !payload.cnf.jwk) {
            errors.push('Missing cnf.jwk claim')
        }

        // Validate cnf.jwk contains only public key parameters
        if (payload.cnf && payload.cnf.jwk) {
            const jwk = payload.cnf.jwk
            if (jwk.d) {
                errors.push(
                    'cnf.jwk should not contain private key material (d parameter)',
                )
            }

            // Check required public key parameters based on key type
            if (jwk.kty === 'RSA') {
                if (!jwk.n || !jwk.e) {
                    errors.push(
                        'RSA public key missing required parameters (n, e)',
                    )
                }
            } else if (jwk.kty === 'OKP') {
                if (!jwk.x || !jwk.crv) {
                    errors.push(
                        'OKP public key missing required parameters (x, crv)',
                    )
                }
            }
        }

        // Validate iat (within 60 seconds)
        if (payload.iat) {
            const currentTime = Math.floor(Date.now() / 1000)
            const timeDiff = Math.abs(currentTime - payload.iat)
            if (timeDiff > 60) {
                errors.push(`iat claim outside acceptable window: ${timeDiff}s`)
            }
        }

        // Verify signature using provided issuer public key
        const signingInput = token.split('.').slice(0, 2).join('.')
        const signature = token.split('.')[2]

        let keyObject
        let algorithm: string

        try {
            keyObject = jwkToKeyObject(issuerPublicKey)

            if (issuerPublicKey.kty === 'RSA') {
                algorithm = 'RSA-SHA256'
            } else if (
                issuerPublicKey.kty === 'OKP' &&
                issuerPublicKey.crv === 'Ed25519'
            ) {
                algorithm = 'ed25519'
            } else {
                throw new Error(`Unsupported key type: ${issuerPublicKey.kty}`)
            }
        } catch (error) {
            errors.push(
                `Failed to create key object: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
            return { valid: false, payload, errors }
        }

        // Verify signature
        let signatureValid = false
        const signatureBuffer = base64urlDecode(signature)

        if (algorithm === 'ed25519') {
            const { verify } = await import('crypto')
            signatureValid = verify(
                null,
                Buffer.from(signingInput),
                keyObject,
                signatureBuffer,
            )
        } else {
            const verifier = createVerify(algorithm)
            verifier.update(signingInput)
            signatureValid = verifier.verify(keyObject, signatureBuffer)
        }

        if (!signatureValid) {
            errors.push('Invalid signature')
        }

        return { valid: signatureValid && errors.length === 0, payload, errors }
    } catch (error) {
        errors.push(
            `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        return { valid: false, payload: null, errors }
    }
}

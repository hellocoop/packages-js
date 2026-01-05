/**
 * HTTP Message Signature verification implementation
 */

import { VerifyRequest, VerifyOptions, VerificationResult } from './types.js'
import {
    importPublicKey,
    verify as cryptoVerify,
    getAlgorithmFromJwk,
    validateJwk,
} from './utils/crypto.js'
import {
    parseSignatureInput,
    parseSignatureKey,
    parseSignature,
    generateSignatureBase,
} from './utils/signature.js'
import { base64urlDecode } from './utils/base64.js'
import { calculateThumbprint } from './utils/thumbprint.js'

// JWKS cache
const jwksCache = new Map<string, { jwks: any; expiresAt: number }>()

/**
 * Normalize headers to a Map
 */
function normalizeHeaders(
    headers: Headers | Record<string, string | string[]>,
): Map<string, string> {
    const result = new Map<string, string>()

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            result.set(key.toLowerCase(), value)
        })
    } else {
        for (const [key, value] of Object.entries(headers)) {
            const normalized = Array.isArray(value) ? value.join(', ') : value
            result.set(key.toLowerCase(), normalized)
        }
    }

    return result
}

/**
 * Fetch JWKS from URL
 */
async function fetchJWKS(url: string, cacheTtl: number): Promise<any> {
    // Check cache
    const cached = jwksCache.get(url)
    if (cached && cached.expiresAt > Date.now()) {
        return cached.jwks
    }

    // Fetch JWKS
    const response = await globalThis.fetch(url)
    if (!response.ok) {
        throw new Error(
            `Failed to fetch JWKS from ${url}: ${response.statusText}`,
        )
    }

    const jwks = await response.json()

    // Cache the result
    jwksCache.set(url, {
        jwks,
        expiresAt: Date.now() + cacheTtl,
    })

    return jwks
}

/**
 * Get public key from JWKS
 */
async function getPublicKeyFromJWKS(
    id: string,
    kid: string,
    wellKnown: string | undefined,
    cacheTtl: number,
): Promise<JsonWebKey> {
    let jwksUrl: string

    if (wellKnown) {
        // Fetch metadata document first
        const metadataUrl = `${id}/.well-known/${wellKnown}`
        const metadata = await fetchJWKS(metadataUrl, cacheTtl)

        if (!metadata.jwks_uri) {
            throw new Error(
                `Metadata document missing jwks_uri: ${metadataUrl}`,
            )
        }

        jwksUrl = metadata.jwks_uri
    } else {
        // Direct JWKS URL
        jwksUrl = id
    }

    // Fetch JWKS
    const jwks = await fetchJWKS(jwksUrl, cacheTtl)

    if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error(`Invalid JWKS format from ${jwksUrl}`)
    }

    // Find key with matching kid
    const key = jwks.keys.find((k: any) => k.kid === kid)

    if (!key) {
        throw new Error(
            `Key with kid="${kid}" not found in JWKS from ${jwksUrl}`,
        )
    }

    return key
}

/**
 * Decode JWT and extract cnf.jwk claim
 */
function decodeJWT(jwt: string): {
    header: any
    payload: any
    publicKey: JsonWebKey
} {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
    }

    const header = JSON.parse(
        new TextDecoder().decode(base64urlDecode(parts[0])),
    )
    const payload = JSON.parse(
        new TextDecoder().decode(base64urlDecode(parts[1])),
    )

    // Extract cnf.jwk
    if (!payload.cnf || !payload.cnf.jwk) {
        throw new Error('JWT missing cnf.jwk claim')
    }

    return {
        header,
        payload,
        publicKey: payload.cnf.jwk,
    }
}

/**
 * Verify HTTP Message Signature
 */
export async function verify(
    request: VerifyRequest,
    options: VerifyOptions = {},
): Promise<VerificationResult> {
    const {
        maxClockSkew = 60,
        jwksCacheTtl = 3600000, // 1 hour
        strictAAuth = true, // Enforce AAuth profile by default
    } = options

    try {
        // Normalize headers
        const headers = normalizeHeaders(request.headers)

        // Parse Signature-Key header FIRST to auto-discover the label
        // Per AAuth: Signature-Key is a Dictionary with exactly one member
        const signatureKeyHeader = headers.get('signature-key')
        if (!signatureKeyHeader) {
            throw new Error('Missing Signature-Key header')
        }

        const signatureKeys = parseSignatureKey(signatureKeyHeader)
        // parseSignatureKey already validates single member and extracts label
        const signatureKey = signatureKeys[0]
        const label = signatureKey.label

        // Parse Signature-Input header and find entry matching the discovered label
        const signatureInputHeader = headers.get('signature-input')
        if (!signatureInputHeader) {
            throw new Error('Missing Signature-Input header')
        }

        const signatureInputs = parseSignatureInput(signatureInputHeader)
        const signatureInput = signatureInputs.find((si) => si.label === label)

        if (!signatureInput) {
            throw new Error(
                `No Signature-Input found for label "${label}" from Signature-Key`,
            )
        }

        const { components, params } = signatureInput

        // Validate that signature-key is in covered components (AAuth profile requirement)
        if (strictAAuth && !components.includes('signature-key')) {
            throw new Error(
                'AAuth profile violation: signature-key must be in covered components',
            )
        }

        // Validate timestamp
        const now = Math.floor(Date.now() / 1000)
        const skew = Math.abs(now - params.created)

        if (skew > maxClockSkew) {
            throw new Error(
                `Signature timestamp out of acceptable range (skew: ${skew}s)`,
            )
        }

        // Get public key based on type
        let publicJwk: JsonWebKey
        let jwtData: { header: any; payload: any; raw: string } | undefined
        let jwksData:
            | { id: string; kid: string; wellKnown?: string }
            | undefined

        if (signatureKey.type === 'hwk') {
            publicJwk = signatureKey.value as JsonWebKey
        } else if (signatureKey.type === 'jwt') {
            const jwtValue = signatureKey.value as { jwt: string }
            const { header, payload, publicKey } = decodeJWT(jwtValue.jwt)
            publicJwk = publicKey
            jwtData = {
                header,
                payload,
                raw: jwtValue.jwt,
            }
        } else if (signatureKey.type === 'jwks') {
            const jwksValue = signatureKey.value as {
                id: string
                kid: string
                wellKnown?: string
            }
            const { id, kid, wellKnown } = jwksValue
            publicJwk = await getPublicKeyFromJWKS(
                id,
                kid,
                wellKnown,
                jwksCacheTtl,
            )
            jwksData = { id, kid, wellKnown }
        } else {
            // Note: x509 scheme not yet implemented
            // Future implementation would:
            // 1. Parse X.509 certificate (PEM/DER format)
            // 2. Extract SubjectPublicKeyInfo
            // 3. Convert to JWK format
            // Recommended library: @peculiar/x509
            // Example:
            // import { X509Certificate } from '@peculiar/x509'
            // const cert = new X509Certificate(x509Value.cert)
            // publicJwk = await cert.publicKey.export('jwk')

            throw new Error(
                `Unsupported signature key type: ${(signatureKey as any).type}`,
            )
        }

        // Validate public key
        validateJwk(publicJwk)

        // Parse Signature header
        const signatureHeader = headers.get('signature')
        if (!signatureHeader) {
            throw new Error('Missing Signature header')
        }

        const signatures = parseSignature(signatureHeader)
        const signature = signatures.get(label)

        if (!signature) {
            throw new Error(`No signature found for label: ${label}`)
        }

        // Build component values
        // Construct full URL from authority, path, and query for @target-uri component
        const queryString = request.query ? `?${request.query}` : ''
        const targetUri = `https://${request.authority}${request.path}${queryString}`

        const componentValues = new Map<string, string>()

        componentValues.set('@method', request.method.toUpperCase())
        componentValues.set('@target-uri', targetUri)

        // Use provided canonical authority (per AAuth Section 10.3.1)
        componentValues.set('@authority', request.authority)

        componentValues.set('@scheme', 'https')
        componentValues.set('@request-target', `${request.path}${queryString}`)
        componentValues.set('@path', request.path)
        componentValues.set('@query', request.query || '')

        // Validate content-digest if body is present
        if (
            request.body !== undefined &&
            components.includes('content-digest')
        ) {
            const expectedDigest = headers.get('content-digest')
            if (!expectedDigest) {
                throw new Error(
                    'content-digest component specified but header missing',
                )
            }

            // Compute actual digest from body
            const { generateContentDigest } = await import(
                './utils/signature.js'
            )
            const actualDigest = await generateContentDigest(
                request.body as any,
            )

            if (actualDigest !== expectedDigest) {
                throw new Error('content-digest does not match body')
            }
        }

        // Add header components
        for (const component of components) {
            if (component.startsWith('@')) {
                // Already handled or will be handled by @signature-params
                continue
            }

            const value = headers.get(component)
            if (value === undefined) {
                throw new Error(`Missing header for component: ${component}`)
            }

            componentValues.set(component, value)
        }

        // Add @signature-params
        const componentList = components.map((c) => `"${c}"`).join(' ')
        const paramPairs = Object.entries(params)
            .map(([key, value]) => {
                if (typeof value === 'number') {
                    return `${key}=${value}`
                }
                // String values from parsing may already have quotes
                const stringValue = String(value)
                if (stringValue.startsWith('"') && stringValue.endsWith('"')) {
                    return `${key}=${stringValue}`
                }
                return `${key}="${stringValue}"`
            })
            .join(';')
        const signatureParams = `(${componentList});${paramPairs}`
        componentValues.set('@signature-params', signatureParams)
        const componentsWithParams = [...components, '@signature-params']

        // Generate signature base
        const signatureBase = generateSignatureBase(
            componentsWithParams,
            componentValues,
        )
        const signatureBaseBytes = new TextEncoder().encode(signatureBase)

        // Calculate JWK thumbprint (stable identifier for the public key)
        const thumbprint = await calculateThumbprint(publicJwk)

        // Import public key and verify
        const publicKey = await importPublicKey(publicJwk)
        const algorithm = getAlgorithmFromJwk(publicJwk)
        const isValid = await cryptoVerify(
            signatureBaseBytes,
            signature,
            publicKey,
            algorithm,
        )

        const result: VerificationResult = {
            verified: isValid,
            label,
            keyType: signatureKey.type,
            publicKey: publicJwk,
            thumbprint,
            created: params.created,
        }

        if (jwtData) {
            result.jwt = jwtData
        }

        if (jwksData) {
            result.jwks = jwksData
        }

        return result
    } catch (error) {
        return {
            verified: false,
            label: '',
            keyType: 'hwk',
            publicKey: {},
            thumbprint: '',
            created: 0,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

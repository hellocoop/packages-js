/**
 * HTTP Message Signature verification implementation
 */

import {
    VerifyRequest,
    VerifyOptions,
    VerificationResult,
    SignatureError,
} from './types.js'
import {
    importPublicKey,
    verify as cryptoVerify,
    getAlgorithmFromJwk,
    validateJwk,
    SUPPORTED_ALGORITHMS,
} from './utils/crypto.js'
import {
    parseSignatureInput,
    parseSignatureKey,
    parseSignature,
    generateSignatureBase,
} from './utils/signature.js'
import { serializeInnerList } from './structured-fields.js'
import { base64urlDecode } from './utils/base64.js'
import { calculateThumbprint } from './utils/thumbprint.js'
import { BoundedTtlCache } from './utils/cache.js'
import {
    SignatureVerificationError,
    invalidInput,
    invalidJwt,
    expiredJwt,
    unsupportedAlgorithm,
    issuerMissing,
    issuerMismatch,
} from './errors.js'

// JWKS cache. Bounded: the cache key is a URL derived from the request being
// verified, so an unauthenticated signer would otherwise be able to grow this
// without limit by varying the id/dwk it presents.
const jwksCache = new BoundedTtlCache<any>()

/**
 * Map a thrown error to a structured SignatureError.
 *
 * A SignatureVerificationError carries its code explicitly. Anything else is
 * matched on message text, which covers paths that still throw plain Errors.
 */
function toSignatureError(error: unknown): SignatureError {
    if (error instanceof SignatureVerificationError) {
        const result: SignatureError = { error: error.code }
        if (error.requiredInput) {
            result.required_input = error.requiredInput
        }
        return result
    }

    return mapToSignatureError(
        error instanceof Error ? error.message : String(error),
    )
}

/**
 * Map an error message from verification to a structured SignatureError
 */
function mapToSignatureError(errorMessage: string): SignatureError {
    if (
        errorMessage.includes('Missing Signature-Key') ||
        errorMessage.includes('Missing Signature-Input') ||
        errorMessage.includes('Missing Signature') ||
        errorMessage.includes('No signature found') ||
        errorMessage.includes('No Signature-Input found') ||
        errorMessage.includes('does not verify') ||
        errorMessage.includes('Signature timestamp out of')
    ) {
        return { error: 'invalid_signature' }
    }
    if (errorMessage.includes('AAuth profile violation')) {
        return {
            error: 'invalid_input',
            required_input: ['@method', '@authority', '@path', 'signature-key'],
        }
    }
    if (errorMessage.includes('content-digest')) {
        return { error: 'invalid_input' }
    }
    if (errorMessage.includes('Missing header for component')) {
        return { error: 'invalid_input' }
    }
    if (
        errorMessage.includes('Unsupported signature key type') ||
        errorMessage.includes('Unsupported Signature-Key scheme')
    ) {
        return { error: 'invalid_key' }
    }
    if (
        errorMessage.includes('Signature-Key') &&
        errorMessage.includes('missing')
    ) {
        return { error: 'invalid_key' }
    }
    if (
        errorMessage.includes('Invalid JWK') ||
        errorMessage.includes('validate') ||
        errorMessage.includes('kty parameter')
    ) {
        return { error: 'invalid_key' }
    }
    if (
        errorMessage.includes('not found in JWKS') ||
        errorMessage.includes('unknown_key')
    ) {
        return { error: 'unknown_key' }
    }
    if (errorMessage.includes('jkt-jwt: JWT expired')) {
        return { error: 'expired_jwt' }
    }
    if (
        errorMessage.includes('jkt-jwt:') ||
        errorMessage.includes('Invalid JWT') ||
        errorMessage.includes('JWT missing')
    ) {
        return { error: 'invalid_jwt' }
    }
    return { error: 'invalid_signature' }
}

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
    if (cached !== undefined) {
        return cached
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
    jwksCache.set(url, jwks, cacheTtl)

    return jwks
}

/**
 * Get public key from JWKS via metadata document
 */
async function getPublicKeyFromJWKS(
    id: string,
    kid: string,
    dwk: string,
    cacheTtl: number,
): Promise<JsonWebKey> {
    // Fetch metadata document first
    const metadataUrl = `${id}/.well-known/${dwk}`
    const metadata = await fetchJWKS(metadataUrl, cacheTtl)

    // Bind the metadata document to the identity it was fetched under. Without
    // this, a document served at {id}/.well-known/{dwk} -- via misconfigured
    // shared hosting or a subdomain takeover -- could point jwks_uri at keys
    // that do not belong to id, and the verifier would attribute the request
    // accordingly. Same check as RFC 8414 Section 3.3.
    if (metadata.issuer === undefined) {
        throw issuerMissing(`Metadata document missing issuer: ${metadataUrl}`)
    }

    // Byte equality as presented, matching the identifier-comparison rule the
    // draft uses for the jwks url. No normalization.
    if (metadata.issuer !== id) {
        throw issuerMismatch(
            `Metadata issuer "${metadata.issuer}" does not match id "${id}"`,
        )
    }

    if (!metadata.jwks_uri) {
        throw new Error(`Metadata document missing jwks_uri: ${metadataUrl}`)
    }

    const jwksUrl = metadata.jwks_uri

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
 * Decode a jwt-scheme assertion and extract its cnf.jwk confirmation key.
 *
 * The issuer's signature over the assertion is NOT checked here -- the caller
 * validates the issuer -- but `exp` is, because `exp` is what bounds how long
 * the confirmation key the assertion carries remains acceptable. An assertion
 * without `exp` would leave that key acceptable indefinitely.
 */
function decodeJWT(
    jwt: string,
    maxClockSkew: number,
): {
    header: any
    payload: any
    publicKey: JsonWebKey
} {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
        throw invalidJwt('Invalid JWT format')
    }

    let header: any
    let payload: any
    try {
        header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])))
        payload = JSON.parse(
            new TextDecoder().decode(base64urlDecode(parts[1])),
        )
    } catch {
        throw invalidJwt('Invalid JWT: header or payload is not valid JSON')
    }

    // Extract cnf.jwk
    if (!payload.cnf || !payload.cnf.jwk) {
        throw invalidJwt('JWT missing cnf.jwk claim')
    }

    const now = Math.floor(Date.now() / 1000)

    if (typeof payload.exp !== 'number') {
        throw invalidJwt('JWT missing required exp claim')
    }
    if (payload.exp + maxClockSkew < now) {
        throw expiredJwt('JWT expired')
    }

    if (payload.iat !== undefined) {
        if (typeof payload.iat !== 'number') {
            throw invalidJwt('JWT iat claim is not a number')
        }
        if (payload.iat - maxClockSkew > now) {
            throw invalidJwt('JWT iat is in the future')
        }
    }

    return {
        header,
        payload,
        publicKey: payload.cnf.jwk,
    }
}

/**
 * JKT-JWT typ value to hash algorithm and iss prefix mapping
 */
const JKT_JWT_TYPES: Record<
    string,
    { hashAlgorithm: 'SHA-256' | 'SHA-512'; issPrefix: string }
> = {
    'jkt-s256+jwt': {
        hashAlgorithm: 'SHA-256',
        issPrefix: 'urn:jkt:sha-256:',
    },
    'jkt-s512+jwt': {
        hashAlgorithm: 'SHA-512',
        issPrefix: 'urn:jkt:sha-512:',
    },
}

/**
 * Verify and decode a jkt-jwt: validate JWT signature, thumbprint, and expiration.
 * Returns the ephemeral public key for HTTP signature verification.
 */
async function verifyJktJwt(
    jwtString: string,
    maxClockSkew: number,
): Promise<{
    header: any
    payload: any
    ephemeralKey: JsonWebKey
    identityKey: JsonWebKey
    identityThumbprint: string
}> {
    const parts = jwtString.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
    }

    // 1. Parse header and payload without verifying signature
    const header = JSON.parse(
        new TextDecoder().decode(base64urlDecode(parts[0])),
    )
    const payload = JSON.parse(
        new TextDecoder().decode(base64urlDecode(parts[1])),
    )

    // 2. Check typ
    const typConfig = JKT_JWT_TYPES[header.typ]
    if (!typConfig) {
        throw new Error(
            `Unsupported jkt-jwt typ: ${header.typ}. Supported: ${Object.keys(JKT_JWT_TYPES).join(', ')}`,
        )
    }

    // 3. Extract identity key from JWT header
    const identityJwk = header.jwk as JsonWebKey
    if (!identityJwk) {
        throw new Error('jkt-jwt: JWT header missing jwk claim')
    }

    // 4. Compute thumbprint of identity key using the hash algorithm from typ
    const thumbprint = await calculateThumbprint(
        identityJwk,
        typConfig.hashAlgorithm,
    )

    // 5. Construct expected iss and verify
    const expectedIss = `${typConfig.issPrefix}${thumbprint}`
    if (payload.iss !== expectedIss) {
        throw new Error(
            `jkt-jwt: iss mismatch. Expected ${expectedIss}, got ${payload.iss}`,
        )
    }

    // 6. Verify JWT signature using the identity key
    validateJwk(identityJwk)
    const identityPublicKey = await importPublicKey(identityJwk)
    const algorithm = getAlgorithmFromJwk(identityJwk)

    // JWT signature is over header.payload (first two parts)
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const signature = base64urlDecode(parts[2])

    const jwtValid = await cryptoVerify(
        signedData,
        signature,
        identityPublicKey,
        algorithm,
    )
    if (!jwtValid) {
        throw new Error('jkt-jwt: JWT signature verification failed')
    }

    // 7. Validate exp and iat
    const now = Math.floor(Date.now() / 1000)

    if (!payload.exp || typeof payload.exp !== 'number') {
        throw new Error('jkt-jwt: JWT missing exp claim')
    }
    if (payload.exp + maxClockSkew < now) {
        throw new Error('jkt-jwt: JWT expired')
    }

    if (!payload.iat || typeof payload.iat !== 'number') {
        throw new Error('jkt-jwt: JWT missing iat claim')
    }
    if (payload.iat - maxClockSkew > now) {
        throw new Error('jkt-jwt: JWT iat is in the future')
    }

    // 8. Extract ephemeral key from cnf.jwk
    if (!payload.cnf || !payload.cnf.jwk) {
        throw new Error('jkt-jwt: JWT missing cnf.jwk claim')
    }

    return {
        header,
        payload,
        ephemeralKey: payload.cnf.jwk,
        identityKey: identityJwk,
        identityThumbprint: expectedIss,
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
        supportedAlgorithms,
    } = options

    // The set this verifier accepts. Reported in Accept-Signature-Alg on an
    // unsupported_algorithm rejection, so a client learns what would work.
    const accepted: readonly string[] =
        supportedAlgorithms ?? SUPPORTED_ALGORITHMS

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

        // signature-key MUST be a covered component. If it is not, an attacker
        // can substitute the scheme or the signer identity without
        // invalidating the signature, so this is not optional.
        if (!components.includes('signature-key')) {
            throw invalidInput('signature-key must be a covered component', [
                '@method',
                '@authority',
                '@path',
                'signature-key',
            ])
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
        let jktJwtData:
            | {
                  header: any
                  payload: any
                  raw: string
                  identityKey: JsonWebKey
                  identityThumbprint: string
              }
            | undefined
        let jwksUriData: { id: string; kid: string; dwk: string } | undefined

        if (signatureKey.type === 'hwk') {
            publicJwk = signatureKey.value as JsonWebKey
        } else if (signatureKey.type === 'jwt') {
            const jwtValue = signatureKey.value as { jwt: string }
            const { header, payload, publicKey } = decodeJWT(
                jwtValue.jwt,
                maxClockSkew,
            )
            publicJwk = publicKey
            jwtData = {
                header,
                payload,
                raw: jwtValue.jwt,
            }
        } else if (signatureKey.type === 'jkt_jwt') {
            const jwtValue = signatureKey.value as { jwt: string }
            const {
                header,
                payload,
                ephemeralKey,
                identityKey,
                identityThumbprint,
            } = await verifyJktJwt(jwtValue.jwt, maxClockSkew)
            publicJwk = ephemeralKey
            jktJwtData = {
                header,
                payload,
                raw: jwtValue.jwt,
                identityKey,
                identityThumbprint,
            }
        } else if (signatureKey.type === 'jwks_uri') {
            const jwksUriValue = signatureKey.value as {
                id: string
                kid: string
                dwk: string
            }
            const { id, kid, dwk } = jwksUriValue
            publicJwk = await getPublicKeyFromJWKS(id, kid, dwk, jwksCacheTtl)
            jwksUriData = { id, kid, dwk }
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

        // Validate public key. This determines the algorithm from the key's
        // alg member and rejects a key that has none.
        validateJwk(publicJwk)

        // The algorithm must be one this verifier accepts. Checked before any
        // signature verification: there is no point verifying with an
        // algorithm that will be declined either way.
        if (!accepted.includes(publicJwk.alg as string)) {
            throw unsupportedAlgorithm(
                `Algorithm "${publicJwk.alg}" is not accepted by this verifier`,
                [...accepted],
            )
        }

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

        // Add @signature-params.
        //
        // Every parameter the signer sent is reproduced verbatim, including an
        // `alg` parameter if one is present. @signature-params is covered by
        // the signature, so dropping a parameter here would change the
        // signature base and fail verification.
        //
        // Reproducing `alg` is not the same as honouring it: the algorithm is
        // taken from the key material only (see getAlgorithmFromJwk below),
        // per RFC 9421 Section 3.3.7. A signer that declares a misleading
        // `alg` does not change which operation the verifier performs.
        //
        // The value is re-serialized from the parsed Inner List rather than
        // rebuilt from the extracted parts, so a String stays a String and a
        // Token stays a Token. Rebuilding by hand is what quoted every value
        // alike and would have corrupted the base for any signer that sent a
        // Token-valued parameter.
        const signatureParams = serializeInnerList(
            signatureInput.signatureParams,
        )
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

        if (jktJwtData) {
            result.jkt_jwt = jktJwtData
        }

        if (jwksUriData) {
            result.jwks_uri = jwksUriData
        }

        return result
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error)
        return {
            verified: false,
            label: '',
            keyType: 'hwk',
            publicKey: {},
            thumbprint: '',
            created: 0,
            error: errorMessage,
            signatureError: toSignatureError(error),
            ...(error instanceof SignatureVerificationError &&
            error.supportedAlgorithms
                ? { acceptSignatureAlg: error.supportedAlgorithms }
                : {}),
        }
    }
}

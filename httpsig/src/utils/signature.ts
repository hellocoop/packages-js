/**
 * HTTP Message Signature generation and parsing utilities
 */

import { base64Encode, sha256 } from './base64.js'
import {
    ParsedSignatureInput,
    ParsedSignatureKey,
    SignatureKeyType,
    SignatureError,
    SignatureErrorCode,
    AcceptSignatureParams,
} from '../types.js'
import { invalidKey, unsupportedScheme } from '../errors.js'

/**
 * Generate signature base string from components
 */
export function generateSignatureBase(
    components: string[],
    componentValues: Map<string, string>,
): string {
    const lines: string[] = []

    for (const component of components) {
        const value = componentValues.get(component)
        if (value === undefined) {
            throw new Error(`Missing value for component: ${component}`)
        }
        lines.push(`"${component}": ${value}`)
    }

    return lines.join('\n')
}

/**
 * Generate Signature-Input header value
 *
 * The `alg` signature parameter is deliberately never emitted. The algorithm
 * is signaled by the key, per the JOSE path of RFC 9421 Section 3.3.7, which
 * states that "the explicit alg signature parameter is not used at all when
 * using JOSE signing algorithms". Emitting it would create a second source of
 * truth in a namespace that does not correspond to the JWK `alg` anyway --
 * JWA values are not registered in the HTTP Signature Algorithms registry.
 */
export function generateSignatureInputHeader(
    label: string,
    components: string[],
    created: number,
): string {
    const componentList = components.map((c) => `"${c}"`).join(' ')
    return `${label}=(${componentList});created=${created}`
}

/**
 * Generate Signature-Key header value as RFC 8941 Dictionary
 * Format: label=scheme;param1="value1";param2="value2"
 *
 * The scheme (hwk, jwt, jwks_uri, x509) is the item value, and
 * scheme-specific parameters are semicolon-separated.
 */
export function generateSignatureKeyHeader(
    label: string,
    signatureKey: SignatureKeyType,
    publicJwk?: JsonWebKey,
): string {
    if (signatureKey.type === 'hwk') {
        if (!publicJwk) {
            throw new Error('Public JWK required for hwk signature key type')
        }

        // alg is REQUIRED and carries the algorithm; the verifier does not
        // derive it from kty and crv.
        if (!publicJwk.alg) {
            throw new Error(
                'Public JWK missing required alg member for hwk signature key type',
            )
        }

        // Build hwk parameters from JWK. kid is deliberately not emitted: the
        // key is inline, so an identifier selects nothing.
        const params: string[] = [
            `alg="${publicJwk.alg}"`,
            `kty="${publicJwk.kty}"`,
        ]

        if (publicJwk.crv) params.push(`crv="${publicJwk.crv}"`)
        if (publicJwk.x) params.push(`x="${publicJwk.x}"`)
        if (publicJwk.y) params.push(`y="${publicJwk.y}"`)
        if (publicJwk.n) params.push(`n="${publicJwk.n}"`)
        if (publicJwk.e) params.push(`e="${publicJwk.e}"`)

        return `${label}=hwk;${params.join(';')}`
    }

    if (signatureKey.type === 'jwt') {
        return `${label}=jwt;jwt="${signatureKey.jwt}"`
    }

    if (signatureKey.type === 'jkt_jwt') {
        return `${label}=jkt-jwt;jwt="${signatureKey.jwt}"`
    }

    if (signatureKey.type === 'jwks_uri') {
        const params = [
            `id="${signatureKey.id}"`,
            `dwk="${signatureKey.dwk}"`,
            `kid="${signatureKey.kid}"`,
        ]

        return `${label}=jwks_uri;${params.join(';')}`
    }

    // Note: x509 scheme not yet implemented
    // Future implementation would look like:
    // if (signatureKey.type === 'x509') {
    //     return `${label}=x509;x5u="${signatureKey.x5u}";x5t="${signatureKey.x5t}"`
    // }
    // Recommended: use @peculiar/x509 for certificate parsing

    throw new Error(
        `Unsupported signature key type: ${(signatureKey as any).type}`,
    )
}

/**
 * Generate Signature header value
 */
export function generateSignatureHeader(
    label: string,
    signature: Uint8Array,
): string {
    const encoded = base64Encode(signature)
    return `${label}=:${encoded}:`
}

/**
 * Generate Content-Digest header value
 */
export async function generateContentDigest(body: BodyInit): Promise<string> {
    let bytes: Uint8Array

    if (typeof body === 'string') {
        bytes = new TextEncoder().encode(body)
    } else if (body instanceof Uint8Array) {
        bytes = body
    } else if (body instanceof ArrayBuffer) {
        bytes = new Uint8Array(body)
    } else if (Buffer.isBuffer(body)) {
        bytes = new Uint8Array(body)
    } else {
        // For other types (ReadableStream, etc.), convert to string
        bytes = new TextEncoder().encode(String(body))
    }

    const hash = await sha256(bytes)
    const encoded = base64Encode(hash)
    return `sha-256=:${encoded}:`
}

/**
 * Parse Signature-Input header
 */
export function parseSignatureInput(header: string): ParsedSignatureInput[] {
    const results: ParsedSignatureInput[] = []

    // Split by comma to handle multiple signatures
    const parts = header.split(',').map((p) => p.trim())

    for (const part of parts) {
        // Format: label=(components);params
        // Note: component list can be empty, so use * instead of +
        const match = part.match(/^([^=]+)=\(([^)]*)\);(.+)$/)
        if (!match) {
            throw new Error(`Invalid Signature-Input format: ${part}`)
        }

        const label = match[1].trim()
        const componentsStr = match[2]
        const paramsStr = match[3]

        // Parse components
        const components = componentsStr
            .split(/\s+/)
            .map((c) => c.replace(/"/g, ''))
            .filter((c) => c)

        // Parse parameters
        const params: any = {}
        const paramPairs = paramsStr.split(';').map((p) => p.trim())

        for (const pair of paramPairs) {
            const [key, value] = pair.split('=').map((s) => s.trim())
            if (key === 'created') {
                params.created = parseInt(value, 10)
            } else {
                params[key] = value
            }
        }

        if (!params.created) {
            throw new Error(
                'Signature-Input missing required parameter: created',
            )
        }

        results.push({ label, components, params })
    }

    return results
}

/**
 * Parse Signature-Key header as RFC 8941 Dictionary
 * Format: label=scheme;param1="value1";param2="value2"
 *
 * The scheme (hwk, jwt, jwks_uri, x509) is the item value (a token),
 * and parameters are semicolon-separated key-value pairs.
 *
 * Per AAuth requirements:
 * - Must be a valid RFC 8941 Dictionary
 * - Must have exactly one dictionary member
 * - The member key is the label
 */
export function parseSignatureKey(header: string): ParsedSignatureKey[] {
    const trimmed = header.trim()

    // Check for multiple members (commas outside of quoted strings indicate multiple dictionary members)
    // Simple check: if there's a comma not inside quotes, reject
    let inQuote = false
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
            inQuote = !inQuote
        } else if (trimmed[i] === ',' && !inQuote) {
            throw new Error(
                'Invalid Signature-Key: must have exactly one dictionary member',
            )
        }
    }

    // RFC 8941 Dictionary format: label=scheme;param1="value1";param2="value2"
    // Match: label=token followed by optional parameters
    // Note: [\w-]+ allows hyphens in labels and scheme names (e.g., sig-b26, jkt-jwt)
    const match = trimmed.match(/^([\w-]+)=([\w-]+)(.*)$/)

    if (!match) {
        throw new Error(
            'Invalid Signature-Key: must be RFC 8941 Dictionary with format label=scheme;params',
        )
    }

    const label = match[1]
    const scheme = match[2]
    const paramsStr = match[3]

    // Parse parameters (semicolon-separated)
    const params: any = {}
    if (paramsStr) {
        // Note: [\w-]+ allows hyphens in parameter names (e.g., jkt-jwt)
        const paramMatches = paramsStr.matchAll(
            /;([\w-]+)=(?:"([^"]*)"|(\w+))/g,
        )

        for (const paramMatch of paramMatches) {
            const key = paramMatch[1]
            const value =
                paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3] // quoted or unquoted value
            params[key] = value
        }
    }

    if (!['hwk', 'jwt', 'jkt-jwt', 'jwks_uri'].includes(scheme)) {
        throw unsupportedScheme(`Unsupported Signature-Key scheme: ${scheme}`)
    }

    if (scheme === 'hwk') {
        // Validate hwk has required parameters
        if (!params.kty) {
            throw invalidKey('Signature-Key hwk scheme missing kty parameter')
        }

        if (!params.alg) {
            throw invalidKey('Signature-Key hwk scheme missing alg parameter')
        }

        // The key is inline, so a kid selects nothing and one that disagrees
        // with the inline key has no defined resolution.
        if (params.kid !== undefined) {
            throw invalidKey(
                'Signature-Key hwk scheme MUST NOT include a kid parameter',
            )
        }

        return [{ label, type: 'hwk', value: params }]
    }

    if (scheme === 'jwt') {
        // Validate jwt has required parameters
        if (!params.jwt) {
            throw new Error('Signature-Key jwt scheme missing jwt parameter')
        }

        return [
            {
                label,
                type: 'jwt',
                value: { jwt: params.jwt },
            },
        ]
    }

    if (scheme === 'jkt-jwt') {
        // Validate jkt-jwt has required parameters
        if (!params.jwt) {
            throw new Error(
                'Signature-Key jkt-jwt scheme missing jwt parameter',
            )
        }

        return [
            {
                label,
                type: 'jkt_jwt',
                value: { jwt: params.jwt },
            },
        ]
    }

    if (scheme === 'jwks_uri') {
        // Validate jwks_uri has required parameters
        if (!params.id || !params.dwk || !params.kid) {
            throw new Error(
                'Signature-Key jwks_uri scheme missing required id/dwk/kid parameters',
            )
        }

        return [
            {
                label,
                type: 'jwks_uri',
                value: {
                    id: params.id,
                    kid: params.kid,
                    dwk: params.dwk,
                },
            },
        ]
    }

    // Note: the x509, jwks, and self-jwt schemes are not yet implemented.
    // Unknown and unimplemented schemes take the same defined path.

    throw unsupportedScheme(`Unsupported Signature-Key scheme: ${scheme}`)
}

/**
 * Generate Signature-Error header value as RFC 8941 Dictionary
 * Format: error=<code>[, required_input=("comp1" "comp2")]
 *
 * The supported_algorithms member was removed in -07. A server states what
 * would have worked in the Accept-Signature-Alg and Accept-Signature-Scheme
 * header fields, which work on a challenge and on an error alike.
 */
export function generateSignatureErrorHeader(
    signatureError: SignatureError,
): string {
    const parts: string[] = [`error=${signatureError.error}`]

    if (signatureError.required_input) {
        const inputList = signatureError.required_input
            .map((c) => `"${c}"`)
            .join(' ')
        parts.push(`required_input=(${inputList})`)
    }

    return parts.join(', ')
}

/**
 * Parse Signature-Error header (RFC 8941 Dictionary)
 */
export function parseSignatureError(header: string): SignatureError {
    const trimmed = header.trim()

    // Parse error token
    const errorMatch = trimmed.match(/error=([\w]+)/)
    if (!errorMatch) {
        throw new Error('Invalid Signature-Error: missing error member')
    }

    const error = errorMatch[1] as SignatureErrorCode
    const validCodes: SignatureErrorCode[] = [
        'unsupported_algorithm',
        'unsupported_scheme',
        'invalid_signature',
        'invalid_input',
        'invalid_request',
        'invalid_key',
        'unknown_key',
        'invalid_jwt',
        'expired_jwt',
    ]
    if (!validCodes.includes(error)) {
        throw new Error(`Invalid Signature-Error code: ${error}`)
    }

    const result: SignatureError = { error }

    // Parse required_input inner list
    const inputMatch = trimmed.match(/required_input=\(([^)]*)\)/)
    if (inputMatch) {
        result.required_input = inputMatch[1]
            .split(/\s+/)
            .map((c) => c.replace(/"/g, ''))
            .filter((c) => c)
    }

    return result
}

/**
 * Generate an RFC 8941 List of Tokens.
 */
function generateTokenList(values: string[]): string {
    for (const value of values) {
        if (!/^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:/]*$/.test(value)) {
            throw new Error(
                `Value is not a valid Structured Field Token: ${value}`,
            )
        }
    }
    return values.join(', ')
}

/**
 * Parse an RFC 8941 List of Tokens, ignoring entries that are not tokens.
 */
function parseTokenList(header: string): string[] {
    return header
        .split(',')
        .map((v) => v.trim())
        .filter((v) => /^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:/]*$/.test(v))
}

/**
 * Generate Accept-Signature-Scheme: the Signature-Key schemes the server
 * accepts, in descending order of preference.
 *
 * Format: scheme1, scheme2
 */
export function generateAcceptSignatureSchemeHeader(schemes: string[]): string {
    return generateTokenList(schemes)
}

/**
 * Parse Accept-Signature-Scheme. Unrecognized tokens are preserved: a client
 * ignores what it does not know so a server may list schemes registered after
 * the client was written.
 */
export function parseAcceptSignatureScheme(header: string): string[] {
    return parseTokenList(header)
}

/**
 * Generate Accept-Signature-Alg: the signature algorithms the server accepts,
 * as fully-specified JOSE identifiers.
 *
 * Format: alg1, alg2
 */
export function generateAcceptSignatureAlgHeader(algs: string[]): string {
    return generateTokenList(algs)
}

/**
 * Parse Accept-Signature-Alg.
 */
export function parseAcceptSignatureAlg(header: string): string[] {
    return parseTokenList(header)
}

/**
 * Generate Accept-Signature header value
 * Format: label=("comp1" "comp2")[;alg="algo"][;tag="tag"]
 *
 * The sigkey parameter was removed in -07. A parameter value is a bare Item
 * and cannot be a list, so sigkey could name only one scheme. Use
 * Accept-Signature-Scheme and Accept-Signature-Alg instead.
 */
export function generateAcceptSignatureHeader(
    params: AcceptSignatureParams,
): string {
    const { label = 'sig', components, alg, tag } = params
    const componentList = components.map((c) => `"${c}"`).join(' ')
    let header = `${label}=(${componentList})`

    if (alg) {
        header += `;alg="${alg}"`
    }
    if (tag) {
        header += `;tag="${tag}"`
    }

    return header
}

/**
 * Parse Accept-Signature header
 * Format: label=("comp1" "comp2")[;alg="algo"][;tag="tag"]
 */
export function parseAcceptSignature(header: string): AcceptSignatureParams {
    const trimmed = header.trim()

    // Match: label=(components);params
    const match = trimmed.match(/^([\w-]+)=\(([^)]*)\)(.*)$/)
    if (!match) {
        throw new Error('Invalid Accept-Signature format')
    }

    const label = match[1]
    const componentsStr = match[2]
    const paramsStr = match[3]

    const components = componentsStr
        .split(/\s+/)
        .map((c) => c.replace(/"/g, ''))
        .filter((c) => c)

    const result: AcceptSignatureParams = { label, components }

    if (paramsStr) {
        // Parse alg string parameter
        const algMatch = paramsStr.match(/;alg="([^"]*)"/)
        if (algMatch) {
            result.alg = algMatch[1]
        }

        // Parse tag string parameter
        const tagMatch = paramsStr.match(/;tag="([^"]*)"/)
        if (tagMatch) {
            result.tag = tagMatch[1]
        }
    }

    return result
}

/**
 * Parse Signature header
 */
export function parseSignature(header: string): Map<string, Uint8Array> {
    const results = new Map<string, Uint8Array>()

    // Split by comma for multiple signatures
    const entries = header.split(/,(?=\s*\w+=)/)

    for (const entry of entries) {
        const trimmed = entry.trim()

        // Format: label=:base64:
        const match = trimmed.match(/^([^=]+)=:([^:]+):$/)
        if (!match) {
            throw new Error(`Invalid Signature format: ${trimmed}`)
        }

        const label = match[1].trim()
        const base64 = match[2]

        const signature = Buffer.from(base64, 'base64')
        results.set(label, new Uint8Array(signature))
    }

    return results
}

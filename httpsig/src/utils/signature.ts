/**
 * HTTP Message Signature generation and parsing utilities
 */

import { base64Encode, sha256 } from './base64.js'
import {
    ParsedSignatureInput,
    ParsedSignatureKey,
    SignatureKeyType,
} from '../types.js'

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
 * Generate Signature-Key header value
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

        // Build hwk parameters from JWK
        const params: string[] = [`kty="${publicJwk.kty}"`]

        if (publicJwk.crv) params.push(`crv="${publicJwk.crv}"`)
        if (publicJwk.x) params.push(`x="${publicJwk.x}"`)
        if (publicJwk.y) params.push(`y="${publicJwk.y}"`)
        if (publicJwk.n) params.push(`n="${publicJwk.n}"`)
        if (publicJwk.e) params.push(`e="${publicJwk.e}"`)

        return `${label}=hwk; ${params.join('; ')}`
    }

    if (signatureKey.type === 'jwt') {
        return `${label}=jwt; jwt="${signatureKey.jwt}"`
    }

    if (signatureKey.type === 'jwks') {
        const params = [`id="${signatureKey.id}"`, `kid="${signatureKey.kid}"`]

        if (signatureKey.wellKnown) {
            params.splice(1, 0, `well-known="${signatureKey.wellKnown}"`)
        }

        return `${label}=jwks; ${params.join('; ')}`
    }

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
        const match = part.match(/^([^=]+)=\(([^)]+)\);(.+)$/)
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
 * Parse Signature-Key header
 */
export function parseSignatureKey(header: string): ParsedSignatureKey[] {
    const results: ParsedSignatureKey[] = []

    // Split by comma for multiple signatures (though typically one)
    const entries = header.split(/,(?=\s*\w+=)/)

    for (const entry of entries) {
        const trimmed = entry.trim()

        // Format: label=type; params
        const match = trimmed.match(/^([^=]+)=(\w+);(.+)$/)
        if (!match) {
            throw new Error(`Invalid Signature-Key format: ${trimmed}`)
        }

        const label = match[1].trim()
        const type = match[2] as 'hwk' | 'jwt' | 'jwks'
        const paramsStr = match[3]

        if (type === 'hwk') {
            // Parse hwk parameters
            const params: any = {}
            const paramPairs = paramsStr.split(';').map((p) => p.trim())

            for (const pair of paramPairs) {
                const [key, value] = pair.split('=').map((s) => s.trim())
                params[key] = value.replace(/^"|"$/g, '')
            }

            results.push({ label, type: 'hwk', value: params })
        } else if (type === 'jwt') {
            // Parse JWT parameter
            const jwtMatch = paramsStr.match(/jwt="([^"]+)"/)
            if (!jwtMatch) {
                throw new Error('Signature-Key jwt type missing jwt parameter')
            }

            results.push({
                label,
                type: 'jwt',
                value: { jwt: jwtMatch[1] },
            })
        } else if (type === 'jwks') {
            // Parse JWKS parameters
            const idMatch = paramsStr.match(/id="([^"]+)"/)
            const kidMatch = paramsStr.match(/kid="([^"]+)"/)
            const wellKnownMatch = paramsStr.match(/well-known="([^"]+)"/)

            if (!idMatch || !kidMatch) {
                throw new Error(
                    'Signature-Key jwks type missing required parameters',
                )
            }

            results.push({
                label,
                type: 'jwks',
                value: {
                    id: idMatch[1],
                    kid: kidMatch[1],
                    wellKnown: wellKnownMatch?.[1],
                },
            })
        } else {
            throw new Error(`Unsupported Signature-Key type: ${type}`)
        }
    }

    return results
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

/**
 * Base64 encoding/decoding utilities for HTTP Message Signatures
 */

/**
 * Encode data to base64url format (RFC 4648 Section 5)
 */
export function base64urlEncode(data: Uint8Array | string): string {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    const base64 = Buffer.from(bytes).toString('base64')

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decode base64url format to Uint8Array
 */
export function base64urlDecode(data: string): Uint8Array {
    // Add padding if needed
    let padded = data
    const padding = (4 - (data.length % 4)) % 4
    if (padding > 0) {
        padded += '='.repeat(padding)
    }

    // Convert base64url to base64
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')

    return new Uint8Array(Buffer.from(base64, 'base64'))
}

/**
 * Encode data to standard base64 format
 */
export function base64Encode(data: Uint8Array | string): string {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    return Buffer.from(bytes).toString('base64')
}

/**
 * Decode standard base64 to Uint8Array
 */
export function base64Decode(data: string): Uint8Array {
    return new Uint8Array(Buffer.from(data, 'base64'))
}

/**
 * SHA-256 hash
 */
export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    return new Uint8Array(hashBuffer)
}

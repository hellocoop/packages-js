/**
 * Base64 encoding/decoding utilities for HTTP Message Signatures
 */

/**
 * Convert Uint8Array to base64 string (browser-safe, no Buffer dependency)
 */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array (browser-safe, no Buffer dependency)
 */
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

/**
 * Encode data to base64url format (RFC 4648 Section 5)
 */
export function base64urlEncode(data: Uint8Array | string): string {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    const base64 = bytesToBase64(bytes)

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

    return base64ToBytes(base64)
}

/**
 * Encode data to standard base64 format
 */
export function base64Encode(data: Uint8Array | string): string {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    return bytesToBase64(bytes)
}

/**
 * Decode standard base64 to Uint8Array
 */
export function base64Decode(data: string): Uint8Array {
    return base64ToBytes(data)
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

/**
 * SHA-512 hash
 */
export async function sha512(data: string | Uint8Array): Promise<Uint8Array> {
    const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

    const hashBuffer = await crypto.subtle.digest('SHA-512', bytes)
    return new Uint8Array(hashBuffer)
}

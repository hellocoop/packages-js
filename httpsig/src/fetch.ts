/**
 * HTTP Message Signature fetch implementation
 */

import { HttpSigFetchOptions } from './types.js'
import {
    importPrivateKey,
    getPublicJwk,
    sign as cryptoSign,
    getAlgorithmFromJwk,
    validateJwk,
} from './utils/crypto.js'
import {
    generateSignatureBase,
    generateSignatureInputHeader,
    generateSignatureKeyHeader,
    generateSignatureHeader,
    generateContentDigest,
} from './utils/signature.js'

/**
 * Signed fetch - wraps standard fetch with HTTP Message Signatures
 */
export async function fetch(
    url: string | URL,
    options: HttpSigFetchOptions,
): Promise<Response | { headers: Headers }> {
    const {
        signingKey,
        signatureKey,
        label = 'sig',
        dryRun = false,
        method = 'GET',
        headers: inputHeaders = {},
        body,
        ...fetchOptions
    } = options

    // Validate signing key
    validateJwk(signingKey)

    // Import private key
    const privateKey = await importPrivateKey(signingKey)
    const algorithm = getAlgorithmFromJwk(signingKey)

    // Get public key for hwk type
    const publicJwk = getPublicJwk(signingKey)

    // Parse URL
    const urlObj = typeof url === 'string' ? new URL(url) : url
    const targetUri = urlObj.href

    // Prepare headers
    const headers = new Headers(inputHeaders)

    // Determine covered components
    const components: string[] = ['@method', '@target-uri']
    const componentValues = new Map<string, string>()

    componentValues.set('@method', `"${method.toUpperCase()}"`)
    componentValues.set('@target-uri', `"${targetUri}"`)

    // Add body-related components if body exists
    if (body !== undefined && body !== null) {
        // Add content-type if not already set
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/octet-stream')
        }

        const contentType = headers.get('content-type')!
        components.push('content-type')
        componentValues.set('content-type', `"${contentType}"`)

        // Generate content-digest
        const contentDigest = await generateContentDigest(body)
        headers.set('content-digest', contentDigest)
        components.push('content-digest')
        componentValues.set('content-digest', `"${contentDigest}"`)
    }

    // Always add signature-key component
    components.push('signature-key')

    // Generate Signature-Key header
    const signatureKeyHeader = generateSignatureKeyHeader(
        label,
        signatureKey,
        publicJwk,
    )
    headers.set('signature-key', signatureKeyHeader)
    componentValues.set('signature-key', `"${signatureKeyHeader}"`)

    // Generate timestamp
    const created = Math.floor(Date.now() / 1000)

    // Generate Signature-Input header
    const signatureInputHeader = generateSignatureInputHeader(
        label,
        components,
        created,
    )
    headers.set('signature-input', signatureInputHeader)

    // Add signature params to component values
    const signatureParams = `("${label}");created=${created}`
    componentValues.set('@signature-params', signatureParams)
    components.push('@signature-params')

    // Generate signature base
    const signatureBase = generateSignatureBase(components, componentValues)
    const signatureBaseBytes = new TextEncoder().encode(signatureBase)

    // Sign the signature base
    const signature = await cryptoSign(
        signatureBaseBytes,
        privateKey,
        algorithm,
    )

    // Generate Signature header
    const signatureHeader = generateSignatureHeader(label, signature)
    headers.set('signature', signatureHeader)

    // If dryRun, return headers only
    if (dryRun) {
        return { headers }
    }

    // Make the actual fetch request
    return globalThis.fetch(urlObj, {
        ...fetchOptions,
        method,
        headers,
        body,
    })
}

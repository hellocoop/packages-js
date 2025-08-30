import { promises as dns } from 'dns'
import type { JWK } from 'jose'
import { EmailVerificationError } from '../errors.js'

/**
 * Error thrown when DNS discovery fails
 */
export class DNSDiscoveryError extends EmailVerificationError {
    constructor(message: string) {
        super(message, 'dns_discovery')
        this.name = 'DNSDiscoveryError'
    }
}

/**
 * Error thrown when JWKS fetching fails
 */
export class JWKSFetchError extends EmailVerificationError {
    constructor(message: string) {
        super(message, 'jwks_fetch')
        this.name = 'JWKSFetchError'
    }
}

/**
 * Extracts domain from email address
 * @param email - Email address
 * @returns Domain part of the email
 */
function extractDomainFromEmail(email: string): string {
    const atIndex = email.lastIndexOf('@')
    if (atIndex === -1) {
        throw new DNSDiscoveryError('Invalid email format: missing @ symbol')
    }
    return email.substring(atIndex + 1)
}

/**
 * Validates domain format
 * @param domain - Domain to validate
 * @returns true if valid domain format
 */
function isValidDomain(domain: string): boolean {
    // Basic domain format validation
    const domainRegex =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    if (!domainRegex.test(domain)) {
        return false
    }

    // Check length constraints
    if (domain.length > 253) {
        return false
    }

    // Check each label length
    const labels = domain.split('.')
    for (const label of labels) {
        if (label.length > 63 || label.length === 0) {
            return false
        }
    }

    // Must have at least one dot (eTLD+1 minimum)
    if (labels.length < 2) {
        return false
    }

    return true
}

/**
 * Discovers the email-verification issuer for an email address or domain via DNS TXT record lookup
 * Looks for TXT record with format: "iss=issuer.example" at "_email-verification.$EMAIL_DOMAIN"
 *
 * NOTE: Spec should clarify that there can only be one iss= record per domain
 *
 * @param emailOrDomain - Email address or domain to lookup
 * @returns Promise resolving to issuer identifier (domain, not URL)
 * @throws DNSDiscoveryError if no issuer is found or DNS lookup fails
 */
export async function discoverIssuer(emailOrDomain: string): Promise<string> {
    // Extract domain if email address is provided
    const domain = emailOrDomain.includes('@')
        ? extractDomainFromEmail(emailOrDomain)
        : emailOrDomain

    // Normalize domain to lowercase
    const normalizedDomain = domain.toLowerCase()

    // Validate domain format
    if (!isValidDomain(normalizedDomain)) {
        throw new DNSDiscoveryError(
            `Invalid domain format: ${normalizedDomain}`,
        )
    }

    // Construct the DNS lookup domain per spec: _email-verification.$EMAIL_DOMAIN
    const lookupDomain = `_email-verification.${normalizedDomain}`

    try {
        // Look up TXT records for the lookup domain
        const txtRecords = await dns.resolveTxt(lookupDomain)

        const issRecords: string[] = []

        // Find all iss= records
        for (const record of txtRecords) {
            const txtValue = Array.isArray(record) ? record.join('') : record

            if (txtValue.startsWith('iss=')) {
                const issuerIdentifier = txtValue
                    .substring('iss='.length)
                    .toLowerCase()

                // Validate issuer identifier format (should be a domain, not URL)
                if (
                    !issuerIdentifier ||
                    issuerIdentifier.includes('://') ||
                    issuerIdentifier.includes('/')
                ) {
                    throw new DNSDiscoveryError(
                        `Invalid issuer identifier format: ${issuerIdentifier}`,
                    )
                }

                // Validate issuer domain format
                if (!isValidDomain(issuerIdentifier)) {
                    throw new DNSDiscoveryError(
                        `Invalid issuer domain format: ${issuerIdentifier}`,
                    )
                }

                issRecords.push(issuerIdentifier)
            }
        }

        if (issRecords.length === 0) {
            throw new DNSDiscoveryError(
                `No iss= TXT record found for domain: ${lookupDomain}`,
            )
        }

        if (issRecords.length > 1) {
            throw new DNSDiscoveryError(
                `Multiple iss= TXT records found for domain: ${lookupDomain}. Spec should allow only one.`,
            )
        }

        return issRecords[0]
    } catch (error) {
        if (error instanceof DNSDiscoveryError) {
            throw error
        }

        throw new DNSDiscoveryError(
            `DNS lookup failed for domain ${lookupDomain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

/**
 * Email Verification metadata structure from /.well-known/email-verification
 */
export interface EmailVerificationMetadata {
    issuance_endpoint: string
    jwks_uri: string
    signing_alg_values_supported?: string[]
}

/**
 * JWKS response structure
 */
export interface JWKSResponse {
    keys: JWK[]
}

/**
 * Options for HTTP requests
 */
export interface RequestOptions {
    /** Request timeout in milliseconds (default: 10000) */
    timeout?: number
    /** Cache timeout in milliseconds (default: 300000 - 5 minutes) */
    cacheTimeout?: number
}

// In-memory caches
const metadataCache = new Map<
    string,
    { metadata: EmailVerificationMetadata; timestamp: number }
>()
const jwksCache = new Map<string, { jwks: JWKSResponse; timestamp: number }>()

/**
 * Creates a fetch request with timeout
 */
async function fetchWithTimeout(
    url: string,
    timeout: number = 10000,
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow', // Follow redirects
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
            throw new JWKSFetchError(`Request timeout after ${timeout}ms`)
        }
        throw error
    }
}

/**
 * Fetches email-verification metadata from an issuer domain
 * Follows the spec path: https://issuer.example/.well-known/email-verification
 * Supports redirects to different subdomains of the same issuer domain
 *
 * @param issuerIdentifier - Issuer identifier (domain, e.g., "issuer.example")
 * @param options - Optional request configuration
 * @returns Promise resolving to email-verification metadata
 * @throws JWKSFetchError if metadata cannot be fetched or parsed
 */
export async function fetchEmailVerificationMetadata(
    issuerIdentifier: string,
    options: RequestOptions = {},
): Promise<EmailVerificationMetadata> {
    const { timeout = 10000, cacheTimeout = 5 * 60 * 1000 } = options

    // Normalize issuer identifier
    const normalizedIssuer = issuerIdentifier.toLowerCase()

    // Check cache first
    const cached = metadataCache.get(normalizedIssuer)
    const now = Date.now()

    if (cached && now - cached.timestamp < cacheTimeout) {
        return cached.metadata
    }

    try {
        // Construct the well-known URL
        const metadataUrl = `https://${normalizedIssuer}/.well-known/email-verification`

        // Fetch metadata with timeout and redirect following
        const response = await fetchWithTimeout(metadataUrl, timeout)

        if (!response.ok) {
            throw new JWKSFetchError(
                `Email-verification metadata fetch failed: ${response.status} ${response.statusText}`,
            )
        }

        // Validate that final URL (after redirects) ends with issuer domain
        const finalUrl = new URL(response.url)
        if (!finalUrl.hostname.endsWith(normalizedIssuer)) {
            throw new JWKSFetchError(
                `Redirect endpoint hostname must end with issuer domain: ${normalizedIssuer}, got: ${finalUrl.hostname}`,
            )
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            throw new JWKSFetchError(
                `Invalid metadata content type: ${contentType}`,
            )
        }

        const metadata = (await response.json()) as EmailVerificationMetadata

        // Validate metadata structure
        if (!metadata || typeof metadata !== 'object') {
            throw new JWKSFetchError('Invalid metadata format: not an object')
        }

        if (!metadata.issuance_endpoint || !metadata.jwks_uri) {
            throw new JWKSFetchError(
                'Invalid metadata format: missing required fields (issuance_endpoint, jwks_uri)',
            )
        }

        // Validate that URLs contain the issuer domain
        const issuanceUrl = new URL(metadata.issuance_endpoint)
        const jwksUrl = new URL(metadata.jwks_uri)

        if (!issuanceUrl.hostname.endsWith(normalizedIssuer)) {
            throw new JWKSFetchError(
                `Issuance endpoint hostname must end with issuer domain: ${normalizedIssuer}`,
            )
        }

        if (!jwksUrl.hostname.endsWith(normalizedIssuer)) {
            throw new JWKSFetchError(
                `JWKS URI hostname must end with issuer domain: ${normalizedIssuer}`,
            )
        }

        // Cache the result
        metadataCache.set(normalizedIssuer, { metadata, timestamp: now })

        return metadata
    } catch (error) {
        if (error instanceof JWKSFetchError) {
            throw error
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new JWKSFetchError(
                `Network error fetching metadata: ${error.message}`,
            )
        }

        throw new JWKSFetchError(
            `Metadata fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

/**
 * Fetches JWKS (JSON Web Key Set) from a JWKS URI
 *
 * @param jwksUri - JWKS URI from email-verification metadata
 * @param options - Optional request configuration
 * @returns Promise resolving to JWKS response
 * @throws JWKSFetchError if JWKS cannot be fetched or parsed
 */
export async function fetchJWKS(
    jwksUri: string,
    options: RequestOptions = {},
): Promise<JWKSResponse> {
    const { timeout = 10000, cacheTimeout = 5 * 60 * 1000 } = options

    // Check cache first
    const cached = jwksCache.get(jwksUri)
    const now = Date.now()

    if (cached && now - cached.timestamp < cacheTimeout) {
        return cached.jwks
    }

    try {
        // Validate JWKS URI
        new URL(jwksUri)

        // Fetch JWKS with timeout
        const response = await fetchWithTimeout(jwksUri, timeout)

        if (!response.ok) {
            throw new JWKSFetchError(
                `JWKS fetch failed: ${response.status} ${response.statusText}`,
            )
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            throw new JWKSFetchError(
                `Invalid JWKS content type: ${contentType}`,
            )
        }

        const jwks = (await response.json()) as JWKSResponse

        // Validate JWKS structure
        if (!jwks || typeof jwks !== 'object' || !Array.isArray(jwks.keys)) {
            throw new JWKSFetchError(
                'Invalid JWKS format: missing or invalid keys array',
            )
        }

        if (jwks.keys.length === 0) {
            throw new JWKSFetchError('JWKS contains no keys')
        }

        // Validate each key has required fields
        for (let i = 0; i < jwks.keys.length; i++) {
            const key = jwks.keys[i]
            if (!key.kty || !key.kid) {
                throw new JWKSFetchError(
                    `Invalid key at index ${i}: missing kty or kid`,
                )
            }
        }

        // Cache the result
        jwksCache.set(jwksUri, { jwks, timestamp: now })

        return jwks
    } catch (error) {
        if (error instanceof JWKSFetchError) {
            throw error
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new JWKSFetchError(
                `Network error fetching JWKS: ${error.message}`,
            )
        }

        throw new JWKSFetchError(
            `JWKS fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
    }
}

/**
 * Clears the in-memory caches for metadata and JWKS
 * Useful for testing or when you want to force fresh fetches
 */
export function clearCaches(): void {
    metadataCache.clear()
    jwksCache.clear()
}

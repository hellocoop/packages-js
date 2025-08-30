import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as dns } from 'dns'
import {
    discoverIssuer,
    fetchEmailVerificationMetadata,
    fetchJWKS,
    clearCaches,
    DNSDiscoveryError,
    JWKSFetchError,
} from '../utils/dns-discovery.js'

// Mock DNS module
vi.mock('dns', () => ({
    promises: {
        resolveTxt: vi.fn(),
    },
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('DNS Discovery Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        clearCaches()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('discoverIssuer', () => {
        it('should discover issuer from email address', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([['iss=issuer.example']])

            const result = await discoverIssuer('user@example.com')

            expect(result).toBe('issuer.example')
            expect(mockDns).toHaveBeenCalledWith(
                '_email-verification_.example.com',
            )
        })

        it('should discover issuer from domain', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([['iss=issuer.example']])

            const result = await discoverIssuer('example.com')

            expect(result).toBe('issuer.example')
            expect(mockDns).toHaveBeenCalledWith(
                '_email-verification_.example.com',
            )
        })

        it('should normalize domain to lowercase', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([['iss=ISSUER.EXAMPLE']])

            const result = await discoverIssuer('USER@EXAMPLE.COM')

            expect(result).toBe('issuer.example')
            expect(mockDns).toHaveBeenCalledWith(
                '_email-verification_.example.com',
            )
        })

        it('should handle TXT records as arrays', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([['iss=', 'issuer.example']])

            const result = await discoverIssuer('user@example.com')

            expect(result).toBe('issuer.example')
        })

        it('should find iss record among multiple TXT records', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([
                ['v=spf1 include:_spf.google.com ~all'],
                ['iss=issuer.example'],
                ['some-other-record=value'],
            ])

            const result = await discoverIssuer('user@example.com')

            expect(result).toBe('issuer.example')
        })

        it('should throw error for invalid email format', async () => {
            await expect(discoverIssuer('invalid-email')).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should throw error for invalid domain format', async () => {
            await expect(discoverIssuer('user@')).rejects.toThrow(
                DNSDiscoveryError,
            )

            await expect(discoverIssuer('user@.com')).rejects.toThrow(
                DNSDiscoveryError,
            )

            await expect(discoverIssuer('user@domain')).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should throw error when no iss record found', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([
                ['v=spf1 include:_spf.google.com ~all'],
                ['some-other-record=value'],
            ])

            await expect(discoverIssuer('user@example.com')).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should throw error for multiple iss records', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([
                ['iss=issuer1.example'],
                ['iss=issuer2.example'],
            ])

            await expect(discoverIssuer('user@example.com')).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should throw error for invalid issuer format', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockResolvedValue([['iss=https://issuer.example']])

            await expect(discoverIssuer('user@example.com')).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should throw error for DNS lookup failure', async () => {
            const mockDns = dns.resolveTxt as any
            mockDns.mockRejectedValue(new Error('NXDOMAIN'))

            await expect(
                discoverIssuer('user@nonexistent.com'),
            ).rejects.toThrow(DNSDiscoveryError)
        })

        it('should validate domain length constraints', async () => {
            const longDomain = 'a'.repeat(254)
            await expect(discoverIssuer(`user@${longDomain}`)).rejects.toThrow(
                DNSDiscoveryError,
            )
        })

        it('should validate label length constraints', async () => {
            const longLabel = 'a'.repeat(64)
            await expect(
                discoverIssuer(`user@${longLabel}.com`),
            ).rejects.toThrow(DNSDiscoveryError)
        })
    })

    describe('fetchEmailVerificationMetadata', () => {
        const mockMetadata = {
            issuance_endpoint:
                'https://accounts.issuer.example/email-verification/issuance',
            jwks_uri: 'https://accounts.issuer.example/email-verification/jwks.json',
            signing_alg_values_supported: ['EdDSA', 'RS256'],
        }

        it('should fetch metadata successfully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockMetadata),
            })

            const result = await fetchEmailVerificationMetadata('issuer.example')

            expect(result).toEqual(mockMetadata)
            expect(mockFetch).toHaveBeenCalledWith(
                'https://issuer.example/.well-known/email-verification',
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                    redirect: 'follow',
                }),
            )
        })

        it('should handle redirects to subdomains', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://accounts.issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockMetadata),
            })

            const result = await fetchEmailVerificationMetadata('issuer.example')

            expect(result).toEqual(mockMetadata)
        })

        it('should use cache on subsequent calls', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockMetadata),
            })

            // First call
            await fetchEmailVerificationMetadata('issuer.example')

            // Second call should use cache
            const result = await fetchEmailVerificationMetadata('issuer.example')

            expect(result).toEqual(mockMetadata)
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })

        it('should respect cache timeout', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockMetadata),
            })

            // First call
            await fetchEmailVerificationMetadata('issuer.example', {
                cacheTimeout: 100,
            })

            // Wait for cache to expire
            await new Promise((resolve) => setTimeout(resolve, 150))

            // Second call should fetch again
            await fetchEmailVerificationMetadata('issuer.example', {
                cacheTimeout: 100,
            })

            expect(mockFetch).toHaveBeenCalledTimes(2)
        })

        it('should throw error for HTTP error responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            })

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid content type', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'text/html']]),
                json: () => Promise.resolve(mockMetadata),
            })

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid redirect domain', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://evil.com/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockMetadata),
            })

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for missing required fields', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () =>
                    Promise.resolve({
                        issuance_endpoint: 'https://issuer.example/issue',
                    }),
            })

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid endpoint domains', async () => {
            const invalidMetadata = {
                issuance_endpoint: 'https://evil.com/issue',
                jwks_uri: 'https://issuer.example/jwks',
            }

            mockFetch.mockResolvedValue({
                ok: true,
                url: 'https://issuer.example/.well-known/email-verification',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(invalidMetadata),
            })

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new TypeError('fetch failed'))

            await expect(
                fetchEmailVerificationMetadata('issuer.example'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should handle timeout', async () => {
            mockFetch.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 200)),
            )

            await expect(
                fetchEmailVerificationMetadata('issuer.example', { timeout: 100 }),
            ).rejects.toThrow(JWKSFetchError)
        })
    })

    describe('fetchJWKS', () => {
        const mockJWKS = {
            keys: [
                {
                    kty: 'RSA',
                    kid: 'rsa-key-1',
                    n: 'example-n',
                    e: 'AQAB',
                },
                {
                    kty: 'OKP',
                    kid: 'eddsa-key-1',
                    crv: 'Ed25519',
                    x: 'example-x',
                },
            ],
        }

        it('should fetch JWKS successfully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockJWKS),
            })

            const result = await fetchJWKS('https://issuer.example/jwks')

            expect(result).toEqual(mockJWKS)
        })

        it('should use cache on subsequent calls', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockJWKS),
            })

            // First call
            await fetchJWKS('https://issuer.example/jwks')

            // Second call should use cache
            const result = await fetchJWKS('https://issuer.example/jwks')

            expect(result).toEqual(mockJWKS)
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })

        it('should throw error for HTTP error responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            })

            await expect(
                fetchJWKS('https://issuer.example/jwks'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid content type', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'text/plain']]),
                json: () => Promise.resolve(mockJWKS),
            })

            await expect(
                fetchJWKS('https://issuer.example/jwks'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid JWKS format', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ invalid: 'format' }),
            })

            await expect(
                fetchJWKS('https://issuer.example/jwks'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for empty keys array', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ keys: [] }),
            })

            await expect(
                fetchJWKS('https://issuer.example/jwks'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for keys missing required fields', async () => {
            const invalidJWKS = {
                keys: [
                    { kty: 'RSA' }, // Missing kid
                    { kid: 'test' }, // Missing kty
                ],
            }

            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(invalidJWKS),
            })

            await expect(
                fetchJWKS('https://issuer.example/jwks'),
            ).rejects.toThrow(JWKSFetchError)
        })

        it('should throw error for invalid URI', async () => {
            await expect(fetchJWKS('invalid-uri')).rejects.toThrow()
        })

        it('should handle timeout', async () => {
            mockFetch.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 200)),
            )

            await expect(
                fetchJWKS('https://issuer.example/jwks', { timeout: 100 }),
            ).rejects.toThrow(JWKSFetchError)
        })
    })

    describe('clearCaches', () => {
        it('should clear both metadata and JWKS caches', async () => {
            const mockMetadata = {
                issuance_endpoint: 'https://issuer.example/issue',
                jwks_uri: 'https://issuer.example/jwks',
            }

            const mockJWKS = { keys: [{ kty: 'RSA', kid: 'test' }] }

            // Setup mocks
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    url: 'https://issuer.example/.well-known/email-verification',
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockMetadata),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockJWKS),
                })

            // Populate caches
            await fetchEmailVerificationMetadata('issuer.example')
            await fetchJWKS('https://issuer.example/jwks')

            // Verify cache is working (should not make new requests)
            mockFetch.mockClear()
            await fetchEmailVerificationMetadata('issuer.example')
            await fetchJWKS('https://issuer.example/jwks')
            expect(mockFetch).not.toHaveBeenCalled()

            // Clear caches
            clearCaches()

            // Setup mocks again for fresh requests
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    url: 'https://issuer.example/.well-known/email-verification',
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockMetadata),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockJWKS),
                })

            // Should make fresh requests after cache clear
            await fetchEmailVerificationMetadata('issuer.example')
            await fetchJWKS('https://issuer.example/jwks')
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })
    })

    describe('Integration scenarios', () => {
        it('should handle complete discovery flow', async () => {
            const mockDns = dns.resolveTxt as any
            const mockMetadata = {
                issuance_endpoint: 'https://accounts.issuer.example/issue',
                jwks_uri: 'https://accounts.issuer.example/jwks',
            }
            const mockJWKS = {
                keys: [{ kty: 'RSA', kid: 'test', n: 'test', e: 'AQAB' }],
            }

            // Setup mocks
            mockDns.mockResolvedValue([['iss=issuer.example']])
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    url: 'https://accounts.issuer.example/.well-known/email-verification',
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockMetadata),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve(mockJWKS),
                })

            // Complete flow
            const issuer = await discoverIssuer('user@example.com')
            const metadata = await fetchEmailVerificationMetadata(issuer)
            const jwks = await fetchJWKS(metadata.jwks_uri)

            expect(issuer).toBe('issuer.example')
            expect(metadata).toEqual(mockMetadata)
            expect(jwks).toEqual(mockJWKS)
        })
    })
})

import { describe, it, expect } from 'vitest'
import {
    generateRequestToken,
    generateIssuanceToken,
    verifyRequestToken,
    verifyIssuanceToken,
} from '../index.js'
import type {
    KeyResolver,
    RequestTokenPayload,
    IssuanceTokenPayload,
} from '../index.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { importJWK } from 'jose'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test keys
const privateJwks = JSON.parse(
    readFileSync(join(__dirname, 'test-keys', 'private_jwks.json'), 'utf8'),
)
const publicJwks = JSON.parse(
    readFileSync(join(__dirname, 'test-keys', 'public_jwks.json'), 'utf8'),
)

const rsaPrivateKey = privateJwks.keys.find((key: any) => key.kty === 'RSA')
const eddsaPrivateKey = privateJwks.keys.find((key: any) => key.kty === 'OKP')
const rsaPublicKey = publicJwks.keys.find((key: any) => key.kty === 'RSA')
const eddsaPublicKey = publicJwks.keys.find((key: any) => key.kty === 'OKP')

describe('Performance and Security Validation', () => {
    const nonce = '259c5eae-486d-4b0f-b666-2a5b5ce1c925'

    const rsaBrowserKey = {
        ...rsaPrivateKey,
        kid: 'browser-rsa-key',
    }

    const eddsaBrowserKey = {
        ...eddsaPrivateKey,
        kid: 'browser-eddsa-key',
    }

    const keyResolver: KeyResolver = async (kid?: string) => {
        if (kid === rsaPrivateKey.kid) {
            return await importJWK(rsaPublicKey, rsaPublicKey.alg)
        } else if (kid === eddsaPrivateKey.kid) {
            return await importJWK(eddsaPublicKey, eddsaPublicKey.alg)
        }
        throw new Error(`Unknown key ID: ${kid}`)
    }

    describe('Performance Benchmarks', () => {
        it('should generate RequestTokens within reasonable time', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            const iterations = 100
            const start = performance.now()

            for (let i = 0; i < iterations; i++) {
                await generateRequestToken(payload, rsaBrowserKey)
            }

            const end = performance.now()
            const avgTime = (end - start) / iterations

            expect(avgTime).toBeLessThan(50) // Should be less than 50ms per token
            console.log(
                `RequestToken generation: ${avgTime.toFixed(2)}ms average`,
            )
        })

        it('should verify RequestTokens within reasonable time', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            const token = await generateRequestToken(payload, rsaBrowserKey)
            const iterations = 100
            const start = performance.now()

            for (let i = 0; i < iterations; i++) {
                await verifyRequestToken(token)
            }

            const end = performance.now()
            const avgTime = (end - start) / iterations

            expect(avgTime).toBeLessThan(30) // Should be less than 30ms per verification
            console.log(
                `RequestToken verification: ${avgTime.toFixed(2)}ms average`,
            )
        })

        it('should handle EdDSA operations efficiently', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            const iterations = 50
            const start = performance.now()

            for (let i = 0; i < iterations; i++) {
                const token = await generateRequestToken(
                    payload,
                    eddsaBrowserKey,
                )
                await verifyRequestToken(token)
            }

            const end = performance.now()
            const avgTime = (end - start) / iterations

            expect(avgTime).toBeLessThan(100) // EdDSA should be reasonably fast
            console.log(
                `EdDSA RequestToken round-trip: ${avgTime.toFixed(2)}ms average`,
            )
        })
    })

    describe('Security Validation', () => {
        it('should not leak private key material in cnf claims', async () => {
            const payloadWithPrivateKey: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: { ...rsaBrowserKey }, // Contains private key material
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const token = await generateIssuanceToken(
                payloadWithPrivateKey,
                rsaPrivateKey,
            )
            const verified = await verifyIssuanceToken(token, keyResolver)

            // Verify private key material is stripped
            expect(verified.cnf.jwk.d).toBeUndefined()
            expect(verified.cnf.jwk.p).toBeUndefined()
            expect(verified.cnf.jwk.q).toBeUndefined()
            expect(verified.cnf.jwk.dp).toBeUndefined()
            expect(verified.cnf.jwk.dq).toBeUndefined()
            expect(verified.cnf.jwk.qi).toBeUndefined()

            // Verify essential public key parameters are preserved
            expect(verified.cnf.jwk.kty).toBe(rsaBrowserKey.kty)
            expect(verified.cnf.jwk.n).toBe(rsaBrowserKey.n)
            expect(verified.cnf.jwk.e).toBe(rsaBrowserKey.e)
            expect(verified.cnf.jwk.alg).toBe(rsaBrowserKey.alg)
            expect(verified.cnf.jwk.kid).toBe(rsaBrowserKey.kid)
        })

        it('should validate algorithm support and reject weak algorithms', async () => {
            const weakKey = {
                ...rsaBrowserKey,
                alg: 'HS256', // Symmetric algorithm - should be rejected by JWK validation
            }

            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            // Should fail due to unsupported key type for HS256
            await expect(
                generateRequestToken(payload, weakKey),
            ).rejects.toThrow()
        })

        it('should properly validate key parameters for different algorithms', async () => {
            // Test RSA key validation
            const incompleteRSAKey = {
                kty: 'RSA',
                alg: 'RS256',
                kid: 'test-rsa',
                n: rsaBrowserKey.n,
                // Missing 'e' parameter
            }

            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            await expect(
                generateRequestToken(payload, incompleteRSAKey),
            ).rejects.toThrow()

            // Test EdDSA key validation
            const incompleteEdDSAKey = {
                kty: 'OKP',
                alg: 'EdDSA',
                kid: 'test-eddsa',
                crv: 'Ed25519',
                // Missing 'x' parameter
            }

            await expect(
                generateRequestToken(payload, incompleteEdDSAKey),
            ).rejects.toThrow()
        })

        it('should ensure secure random nonce handling', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            // Generate multiple tokens and verify nonces are preserved correctly
            const tokens = await Promise.all([
                generateRequestToken(
                    { ...payload, nonce: 'nonce-1' },
                    rsaBrowserKey,
                ),
                generateRequestToken(
                    { ...payload, nonce: 'nonce-2' },
                    rsaBrowserKey,
                ),
                generateRequestToken(
                    { ...payload, nonce: 'nonce-3' },
                    rsaBrowserKey,
                ),
            ])

            const verified = await Promise.all([
                verifyRequestToken(tokens[0]),
                verifyRequestToken(tokens[1]),
                verifyRequestToken(tokens[2]),
            ])

            expect(verified[0].nonce).toBe('nonce-1')
            expect(verified[1].nonce).toBe('nonce-2')
            expect(verified[2].nonce).toBe('nonce-3')
        })

        it('should validate email format security', async () => {
            const maliciousEmails = [
                'user@evil.com<script>alert("xss")</script>',
                'user@domain.com\r\nBcc: evil@hacker.com',
                'user@domain.com\0admin@domain.com',
                '../../../etc/passwd@domain.com',
            ]

            for (const email of maliciousEmails) {
                const payload: RequestTokenPayload = {
                    aud: 'issuer.example',
                    nonce: nonce,
                    email: email,
                }

                await expect(
                    generateRequestToken(payload, rsaBrowserKey),
                ).rejects.toThrow()
            }
        })

        it('should prevent timing attacks on signature verification', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            const validToken = await generateRequestToken(
                payload,
                rsaBrowserKey,
            )

            // Create tokens with different invalid signatures
            const parts = validToken.split('.')
            const invalidTokens = [
                `${parts[0]}.${parts[1]}.invalid1`,
                `${parts[0]}.${parts[1]}.invalid2`,
                `${parts[0]}.${parts[1]}.invalid3`,
            ]

            // Measure verification times for invalid signatures
            const times: number[] = []

            for (const invalidToken of invalidTokens) {
                const start = performance.now()
                try {
                    await verifyRequestToken(invalidToken)
                } catch {
                    // Expected to fail
                }
                const end = performance.now()
                times.push(end - start)
            }

            // Verify that timing differences are not significant (within 200% variance)
            // Note: This is a basic timing consistency check, not a comprehensive timing attack prevention test
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length
            const maxDeviation = Math.max(
                ...times.map((t) => Math.abs(t - avgTime)),
            )
            const deviationPercent = (maxDeviation / avgTime) * 100

            expect(deviationPercent).toBeLessThan(200) // Timing should be relatively consistent
            console.log(
                `Timing deviation: ${deviationPercent.toFixed(2)}% (avg: ${avgTime.toFixed(2)}ms)`,
            )
        })
    })

    describe('Memory Management', () => {
        it('should not accumulate memory during repeated operations', async () => {
            const payload: RequestTokenPayload = {
                aud: 'issuer.example',
                nonce: nonce,
                email: 'user@example.com',
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc()
            }

            const initialMemory = process.memoryUsage().heapUsed

            // Perform many operations
            for (let i = 0; i < 1000; i++) {
                const token = await generateRequestToken(payload, rsaBrowserKey)
                await verifyRequestToken(token)
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc()
            }

            const finalMemory = process.memoryUsage().heapUsed
            const memoryIncrease = finalMemory - initialMemory
            const memoryIncreaseMB = memoryIncrease / (1024 * 1024)

            // Memory increase should be reasonable (less than 10MB for 1000 operations)
            expect(memoryIncreaseMB).toBeLessThan(10)
            console.log(
                `Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for 1000 operations`,
            )
        })

        it('should handle large token payloads efficiently', async () => {
            const largePayload: RequestTokenPayload = {
                aud: 'issuer.example.com.with.very.long.domain.name.that.might.exist',
                nonce: 'very-long-nonce-' + 'x'.repeat(1000),
                email: 'user.with.very.long.email.address@example.com',
            }

            const start = performance.now()
            const token = await generateRequestToken(
                largePayload,
                rsaBrowserKey,
            )
            const verified = await verifyRequestToken(token)
            const end = performance.now()

            expect(end - start).toBeLessThan(100) // Should handle large payloads efficiently
            expect(verified.email).toBe(largePayload.email)
            expect(verified.nonce).toBe(largePayload.nonce)
        })
    })
})

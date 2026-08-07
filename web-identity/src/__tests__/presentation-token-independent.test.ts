import { describe, it, expect } from 'vitest'
import { generateIssuanceToken } from '../tokens/issuance-token.js'
import { generatePresentationToken } from '../tokens/presentation-token.js'
import { verifyPresentationTokenIndependent } from './independent-verify.js'
import type { IssuanceTokenPayload } from '../types.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

describe('PresentationToken Independent Verification', () => {
    const audience = 'https://rp.example'
    const nonce = '259c5eae-486d-4b0f-b666-2a5b5ce1c925'

    // Browser keys for testing
    const rsaBrowserKey = {
        ...rsaPrivateKey,
        kid: 'browser-rsa-key',
    }

    const eddsaBrowserKey = {
        ...eddsaPrivateKey,
        kid: 'browser-eddsa-key',
    }

    describe('RSA Issuer with RSA Browser', () => {
        it('should generate and independently verify PresentationToken', async () => {
            // Create IssuanceToken with RSA issuer and RSA browser key
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                rsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(true)
            expect(verification.errors).toHaveLength(0)
            expect(verification.sdJwtPayload.iss).toBe('issuer.example')
            expect(verification.sdJwtPayload.email).toBe('user@example.com')
            expect(verification.kbJwtPayload.aud).toBe(audience)
            expect(verification.kbJwtPayload.nonce).toBe(nonce)
        })
    })

    describe('RSA Issuer with EdDSA Browser', () => {
        it('should generate and independently verify PresentationToken', async () => {
            // Create IssuanceToken with RSA issuer and EdDSA browser key
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: eddsaBrowserKey.kty,
                        crv: eddsaBrowserKey.crv,
                        x: eddsaBrowserKey.x,
                        alg: eddsaBrowserKey.alg,
                        kid: eddsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                eddsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                rsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(true)
            expect(verification.errors).toHaveLength(0)
            expect(verification.sdJwtPayload.iss).toBe('issuer.example')
            expect(verification.sdJwtPayload.email).toBe('user@example.com')
            expect(verification.kbJwtPayload.aud).toBe(audience)
            expect(verification.kbJwtPayload.nonce).toBe(nonce)
        })
    })

    describe('EdDSA Issuer with RSA Browser', () => {
        it('should generate and independently verify PresentationToken', async () => {
            // Create IssuanceToken with EdDSA issuer and RSA browser key
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                eddsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(true)
            expect(verification.errors).toHaveLength(0)
            expect(verification.sdJwtPayload.iss).toBe('issuer.example')
            expect(verification.sdJwtPayload.email).toBe('user@example.com')
            expect(verification.kbJwtPayload.aud).toBe(audience)
            expect(verification.kbJwtPayload.nonce).toBe(nonce)
        })
    })

    describe('EdDSA Issuer with EdDSA Browser', () => {
        it('should generate and independently verify PresentationToken', async () => {
            // Create IssuanceToken with EdDSA issuer and EdDSA browser key
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: eddsaBrowserKey.kty,
                        crv: eddsaBrowserKey.crv,
                        x: eddsaBrowserKey.x,
                        alg: eddsaBrowserKey.alg,
                        kid: eddsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                eddsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                eddsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(true)
            expect(verification.errors).toHaveLength(0)
            expect(verification.sdJwtPayload.iss).toBe('issuer.example')
            expect(verification.sdJwtPayload.email).toBe('user@example.com')
            expect(verification.kbJwtPayload.aud).toBe(audience)
            expect(verification.kbJwtPayload.nonce).toBe(nonce)
        })
    })

    describe('Error Detection', () => {
        it('should detect invalid signature in independent verification', async () => {
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            // Tamper with the KB-JWT part
            const parts = presentationToken.split('~')
            const kbJwtParts = parts[1].split('.')
            const tamperedKbJwt = `${kbJwtParts[0]}.${kbJwtParts[1]}.invalid-signature`
            const tamperedToken = `${parts[0]}~${tamperedKbJwt}`

            const verification = await verifyPresentationTokenIndependent(
                tamperedToken,
                rsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(false)
            expect(verification.errors).toContain('Invalid KB-JWT signature')
        })

        it('should detect audience mismatch', async () => {
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                rsaPublicKey,
                'https://wrong-rp.example', // Wrong audience
                nonce,
            )

            expect(verification.valid).toBe(false)
            expect(
                verification.errors.some((error) =>
                    error.includes('audience mismatch'),
                ),
            ).toBe(true)
        })

        it('should detect nonce mismatch', async () => {
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                rsaPublicKey,
                audience,
                'wrong-nonce', // Wrong nonce
            )

            expect(verification.valid).toBe(false)
            expect(
                verification.errors.some((error) =>
                    error.includes('nonce mismatch'),
                ),
            ).toBe(true)
        })

        it('should detect malformed token format', async () => {
            const malformedToken = 'not-a-valid-presentation-token'

            const verification = await verifyPresentationTokenIndependent(
                malformedToken,
                rsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(false)
            expect(verification.errors).toContain(
                'PresentationToken must contain exactly one tilde separator',
            )
        })

        it('should detect expired KB-JWT', async () => {
            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: rsaBrowserKey.kty,
                        n: rsaBrowserKey.n,
                        e: rsaBrowserKey.e,
                        alg: rsaBrowserKey.alg,
                        kid: rsaBrowserKey.kid,
                    },
                },
                email: 'user@example.com',
                email_verified: true,
                iat: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            )

            const verification = await verifyPresentationTokenIndependent(
                presentationToken,
                rsaPublicKey,
                audience,
                nonce,
            )

            expect(verification.valid).toBe(false)
            expect(
                verification.errors.some((error) =>
                    error.includes('iat claim outside acceptable window'),
                ),
            ).toBe(true)
        })
    })
})

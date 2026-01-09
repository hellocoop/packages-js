import { describe, it, expect } from 'vitest'
import {
    generateIssuanceToken,
    verifyIssuanceToken,
    generatePresentationToken,
    verifyPresentationToken,
} from '../index.js'
import type { KeyResolver, IssuanceTokenPayload } from '../index.js'
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

describe('End-to-End Token Flow', () => {
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

    // Key resolver for testing
    const keyResolver: KeyResolver = async (kid?: string) => {
        if (kid === rsaPrivateKey.kid) {
            return await importJWK(rsaPublicKey, rsaPublicKey.alg)
        } else if (kid === eddsaPrivateKey.kid) {
            return await importJWK(eddsaPublicKey, eddsaPublicKey.alg)
        }
        throw new Error(`Unknown key ID: ${kid}`)
    }

    describe('Complete Flow: RSA Issuer with RSA Browser', () => {
        it('should complete full token flow: IssuanceToken → PresentationToken', async () => {
            // Step 1: Issuer generates IssuanceToken
            // (In real flow, this happens after verifying HTTP Message Signature)
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            expect(issuanceToken).toBeTypeOf('string')

            // Step 2: Browser verifies IssuanceToken
            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )
            expect(verifiedIssued.email).toBe('user@example.com')
            expect(verifiedIssued.email_verified).toBe(true)
            expect(verifiedIssued.iss).toBe('issuer.example')

            // Step 3: Browser generates PresentationToken
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                rsaBrowserKey,
            )
            expect(presentationToken).toBeTypeOf('string')
            expect(presentationToken).toContain('~')

            // Step 4: Relying Party verifies PresentationToken
            const verifiedPresentation = await verifyPresentationToken(
                presentationToken,
                audience,
                nonce,
                keyResolver,
            )

            expect(verifiedPresentation.sdJwt.email).toBe('user@example.com')
            expect(verifiedPresentation.sdJwt.email_verified).toBe(true)
            expect(verifiedPresentation.sdJwt.iss).toBe('issuer.example')
            expect(verifiedPresentation.kbJwt.aud).toBe(audience)
            expect(verifiedPresentation.kbJwt.nonce).toBe(nonce)

            // Verify the complete chain of trust
            expect(verifiedPresentation.sdJwt.cnf.jwk.kid).toBe(
                rsaBrowserKey.kid,
            )
            expect(verifiedPresentation.sdJwt.cnf.jwk.n).toBe(rsaBrowserKey.n)
            expect(verifiedPresentation.sdJwt.cnf.jwk.e).toBe(rsaBrowserKey.e)
        })
    })

    describe('Complete Flow: RSA Issuer with EdDSA Browser', () => {
        it('should complete full token flow with cross-algorithm support', async () => {
            // Step 1: Issuer generates IssuanceToken with RSA, embedding EdDSA browser key
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            ) // RSA issuer

            // Step 2: Browser verifies IssuanceToken
            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )
            expect(verifiedIssued.email).toBe('user@example.com')

            // Step 3: Browser generates PresentationToken with EdDSA
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                eddsaBrowserKey, // EdDSA browser key
            )

            // Step 4: Relying Party verifies PresentationToken
            const verifiedPresentation = await verifyPresentationToken(
                presentationToken,
                audience,
                nonce,
                keyResolver,
            )

            expect(verifiedPresentation.sdJwt.email).toBe('user@example.com')
            expect(verifiedPresentation.kbJwt.aud).toBe(audience)

            // Verify cross-algorithm compatibility
            expect(verifiedPresentation.sdJwt.cnf.jwk.kty).toBe('OKP') // EdDSA browser key
            expect(verifiedPresentation.sdJwt.cnf.jwk.crv).toBe('Ed25519')
        })
    })

    describe('Complete Flow: EdDSA Issuer with RSA Browser', () => {
        it('should complete full token flow with EdDSA issuer and RSA browser', async () => {
            // Step 1: Issuer generates IssuanceToken with EdDSA, embedding RSA browser key
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            ) // EdDSA issuer

            // Step 2: Browser verifies IssuanceToken
            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )
            expect(verifiedIssued.email).toBe('user@example.com')

            // Step 3: Browser generates PresentationToken with RSA
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                rsaBrowserKey, // RSA browser key
            )

            // Step 4: Relying Party verifies PresentationToken
            const verifiedPresentation = await verifyPresentationToken(
                presentationToken,
                audience,
                nonce,
                keyResolver,
            )

            expect(verifiedPresentation.sdJwt.email).toBe('user@example.com')
            expect(verifiedPresentation.kbJwt.aud).toBe(audience)

            // Verify cross-algorithm compatibility
            expect(verifiedPresentation.sdJwt.cnf.jwk.kty).toBe('RSA') // RSA browser key
        })
    })

    describe('Complete Flow: EdDSA Issuer with EdDSA Browser', () => {
        it('should complete full token flow with both EdDSA', async () => {
            // Step 1: Issuer generates IssuanceToken with EdDSA, embedding EdDSA browser key
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            ) // EdDSA issuer

            // Step 2: Browser verifies IssuanceToken
            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )
            expect(verifiedIssued.email).toBe('user@example.com')

            // Step 3: Browser generates PresentationToken with EdDSA
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                eddsaBrowserKey, // EdDSA browser key
            )

            // Step 4: Relying Party verifies PresentationToken
            const verifiedPresentation = await verifyPresentationToken(
                presentationToken,
                audience,
                nonce,
                keyResolver,
            )

            expect(verifiedPresentation.sdJwt.email).toBe('user@example.com')
            expect(verifiedPresentation.kbJwt.aud).toBe(audience)

            // Verify EdDSA-to-EdDSA compatibility
            expect(verifiedPresentation.sdJwt.cnf.jwk.kty).toBe('OKP')
            expect(verifiedPresentation.sdJwt.cnf.jwk.crv).toBe('Ed25519')
        })
    })

    describe('is_private_email support', () => {
        it('should include is_private_email claim when set to true', async () => {
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
                email: 'disposable-abc123@issuer.example',
                email_verified: true,
                is_private_email: true,
            }

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            )

            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )

            expect(verifiedIssued.is_private_email).toBe(true)
            expect(verifiedIssued.email).toBe(
                'disposable-abc123@issuer.example',
            )
        })

        it('should include is_private_email claim when set to false', async () => {
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
                is_private_email: false,
            }

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            )

            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )

            expect(verifiedIssued.is_private_email).toBe(false)
        })

        it('should not include is_private_email claim when not set', async () => {
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                eddsaPrivateKey,
            )

            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )

            expect(verifiedIssued.is_private_email).toBeUndefined()
        })
    })

    describe('Error Propagation Through Flow', () => {
        it('should handle time validation errors', async () => {
            const expiredTime = Math.floor(Date.now() / 1000) - 120 // 2 minutes ago

            // Test expired IssuanceToken
            const expiredIssuancePayload: IssuanceTokenPayload = {
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
                iat: expiredTime,
            }

            const expiredIssuanceToken = await generateIssuanceToken(
                expiredIssuancePayload,
                rsaPrivateKey,
            )

            // Should fail at IssuanceToken verification
            await expect(
                verifyIssuanceToken(expiredIssuanceToken, keyResolver),
            ).rejects.toThrow()
        })

        it('should handle signature tampering', async () => {
            // Generate valid tokens
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                rsaBrowserKey,
            )

            // Tamper with PresentationToken
            const parts = presentationToken.split('~')
            const kbJwtParts = parts[1].split('.')
            const tamperedToken = `${parts[0]}~${kbJwtParts[0]}.${kbJwtParts[1]}.invalid-signature`

            // Should fail at PresentationToken verification
            await expect(
                verifyPresentationToken(
                    tamperedToken,
                    audience,
                    nonce,
                    keyResolver,
                ),
            ).rejects.toThrow()
        })
    })

    describe('Token Compatibility Verification', () => {
        it('should ensure tokens are compatible across generate/verify function pairs', async () => {
            // Test IssuanceToken compatibility
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

            const issuanceToken = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )
            const verifiedIssued = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
            )

            // Ensure all fields are preserved correctly
            expect(verifiedIssued.iss).toBe(issuanceTokenPayload.iss)
            expect(verifiedIssued.email).toBe(issuanceTokenPayload.email)
            expect(verifiedIssued.email_verified).toBe(
                issuanceTokenPayload.email_verified,
            )
            expect(verifiedIssued.cnf.jwk).toEqual(issuanceTokenPayload.cnf.jwk)
            expect(verifiedIssued.iat).toBeTypeOf('number')

            // Test PresentationToken compatibility
            const presentationToken = await generatePresentationToken(
                issuanceToken,
                audience,
                nonce,
                rsaBrowserKey,
            )
            const verifiedPresentation = await verifyPresentationToken(
                presentationToken,
                audience,
                nonce,
                keyResolver,
            )

            // Ensure all fields are preserved correctly
            expect(verifiedPresentation.sdJwt).toEqual(verifiedIssued)
            expect(verifiedPresentation.kbJwt.aud).toBe(audience)
            expect(verifiedPresentation.kbJwt.nonce).toBe(nonce)
            expect(verifiedPresentation.kbJwt.iat).toBeTypeOf('number')
            expect(verifiedPresentation.kbJwt.sd_hash).toBeTypeOf('string')
        })
    })
})

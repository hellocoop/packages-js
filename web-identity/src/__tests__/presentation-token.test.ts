import { describe, it, expect } from 'vitest'
import {
    generatePresentationToken,
    verifyPresentationToken,
} from '../tokens/presentation-token.js'
import { generateIssuanceToken } from '../tokens/issuance-token.js'
import type { IssuanceTokenPayload, KeyResolver } from '../types.js'
import {
    TimeValidationError,
    InvalidSignatureError,
    TokenFormatError,
} from '../errors.js'
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

describe('PresentationToken Functions', () => {
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

    describe('generatePresentationToken', () => {
        it('should generate valid PresentationToken with RSA browser key', async () => {
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

            expect(presentationToken).toBeTypeOf('string')
            expect(presentationToken).toContain('~') // Should contain tilde separator

            const parts = presentationToken.split('~')
            expect(parts).toHaveLength(2)
            expect(parts[0]).toBe(sdJwt) // First part should be the SD-JWT
            expect(parts[1].split('.')).toHaveLength(3) // Second part should be a JWT (KB-JWT)
        })

        it('should generate valid PresentationToken with EdDSA browser key', async () => {
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

            expect(presentationToken).toBeTypeOf('string')
            expect(presentationToken).toContain('~')

            const parts = presentationToken.split('~')
            expect(parts).toHaveLength(2)
            expect(parts[0]).toBe(sdJwt)
            expect(parts[1].split('.')).toHaveLength(3)
        })

        it('should calculate correct sd_hash', async () => {
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

            // Parse the KB-JWT to check sd_hash
            const kbJwt = presentationToken.split('~')[1]
            const kbPayload = JSON.parse(
                Buffer.from(kbJwt.split('.')[1], 'base64url').toString(),
            )

            expect(kbPayload.sd_hash).toBeTypeOf('string')
            expect(kbPayload.sd_hash).toHaveLength(43) // Base64url encoded SHA-256 hash length
        })

        it('should set correct KB-JWT header and payload', async () => {
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

            // Parse the KB-JWT
            const kbJwt = presentationToken.split('~')[1]
            const kbHeader = JSON.parse(
                Buffer.from(kbJwt.split('.')[0], 'base64url').toString(),
            )
            const kbPayload = JSON.parse(
                Buffer.from(kbJwt.split('.')[1], 'base64url').toString(),
            )

            expect(kbHeader.typ).toBe('kb+jwt')
            expect(kbHeader.alg).toBe(rsaBrowserKey.alg)

            expect(kbPayload.aud).toBe(audience)
            expect(kbPayload.nonce).toBe(nonce)
            expect(kbPayload.iat).toBeTypeOf('number')
            expect(kbPayload.sd_hash).toBeTypeOf('string')
        })

        it('should throw error for empty SD-JWT', async () => {
            await expect(
                generatePresentationToken('', audience, nonce, rsaBrowserKey),
            ).rejects.toThrow(TokenFormatError)
        })

        it('should throw error for invalid JWK', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { alg: _alg, ...invalidKey } = rsaBrowserKey

            const issuanceTokenPayload: IssuanceTokenPayload = {
                iss: 'issuer.example',
                cnf: {
                    jwk: {
                        kty: 'RSA',
                        n: 'test',
                        e: 'AQAB',
                        alg: 'RS256',
                        kid: 'test',
                    },
                },
                email: 'user@example.com',
                email_verified: true,
            }

            const sdJwt = await generateIssuanceToken(
                issuanceTokenPayload,
                rsaPrivateKey,
            )

            await expect(
                generatePresentationToken(sdJwt, audience, nonce, invalidKey),
            ).rejects.toThrow()
        })
    })

    describe('verifyPresentationToken', () => {
        it('should verify valid PresentationToken with RSA keys', async () => {
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

            const verified = await verifyPresentationToken(
                presentationToken,
                keyResolver,
                audience,
                nonce,
            )

            expect(verified.sdJwt.iss).toBe('issuer.example')
            expect(verified.sdJwt.email).toBe('user@example.com')
            expect(verified.sdJwt.email_verified).toBe(true)
            expect(verified.kbJwt.aud).toBe(audience)
            expect(verified.kbJwt.nonce).toBe(nonce)
            expect(verified.kbJwt.iat).toBeTypeOf('number')
            expect(verified.kbJwt.sd_hash).toBeTypeOf('string')
        })

        it('should verify valid PresentationToken with EdDSA keys', async () => {
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

            const verified = await verifyPresentationToken(
                presentationToken,
                keyResolver,
                audience,
                nonce,
            )

            expect(verified.sdJwt.iss).toBe('issuer.example')
            expect(verified.sdJwt.email).toBe('user@example.com')
            expect(verified.sdJwt.email_verified).toBe(true)
            expect(verified.kbJwt.aud).toBe(audience)
            expect(verified.kbJwt.nonce).toBe(nonce)
        })

        it('should throw error for audience mismatch', async () => {
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

            await expect(
                verifyPresentationToken(
                    presentationToken,
                    keyResolver,
                    'https://wrong-rp.example',
                    nonce,
                ),
            ).rejects.toThrow(InvalidSignatureError)
        })

        it('should throw error for nonce mismatch', async () => {
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

            await expect(
                verifyPresentationToken(
                    presentationToken,
                    keyResolver,
                    audience,
                    'wrong-nonce',
                ),
            ).rejects.toThrow(InvalidSignatureError)
        })

        it('should throw error for invalid signature', async () => {
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

            // Tamper with the KB-JWT signature
            const parts = presentationToken.split('~')
            const kbJwtParts = parts[1].split('.')
            const tamperedToken = `${parts[0]}~${kbJwtParts[0]}.${kbJwtParts[1]}.invalid-signature`

            await expect(
                verifyPresentationToken(
                    tamperedToken,
                    keyResolver,
                    audience,
                    nonce,
                ),
            ).rejects.toThrow(InvalidSignatureError)
        })

        it('should throw error for malformed token format', async () => {
            await expect(
                verifyPresentationToken(
                    'not-a-valid-token',
                    keyResolver,
                    audience,
                    nonce,
                ),
            ).rejects.toThrow(TokenFormatError)
        })

        it('should throw error for missing tilde separator', async () => {
            await expect(
                verifyPresentationToken(
                    'jwt.without.tilde.separator',
                    keyResolver,
                    audience,
                    nonce,
                ),
            ).rejects.toThrow(TokenFormatError)
        })

        it('should throw error for wrong KB-JWT type', async () => {
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

            // Create a KB-JWT with wrong type
            const wrongHeader = { alg: 'RS256', typ: 'JWT' } // Wrong type
            const kbPayload = {
                aud: audience,
                nonce: nonce,
                iat: Math.floor(Date.now() / 1000),
                sd_hash: 'test',
            }

            const headerB64 = Buffer.from(JSON.stringify(wrongHeader)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(JSON.stringify(kbPayload)).toString(
                'base64url',
            )
            const wrongKbJwt = `${headerB64}.${payloadB64}.invalid-signature`

            const invalidToken = `${sdJwt}~${wrongKbJwt}`

            await expect(
                verifyPresentationToken(
                    invalidToken,
                    keyResolver,
                    audience,
                    nonce,
                ),
            ).rejects.toThrow()
        })

        it('should throw error for expired KB-JWT', async () => {
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

            await expect(
                verifyPresentationToken(
                    presentationToken,
                    keyResolver,
                    audience,
                    nonce,
                ),
            ).rejects.toThrow(TimeValidationError)
        })
    })

    describe('Cross-algorithm compatibility', () => {
        it('should handle RSA issuer with EdDSA browser', async () => {
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
            ) // RSA issuer
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                eddsaBrowserKey,
            ) // EdDSA browser

            const verified = await verifyPresentationToken(
                presentationToken,
                keyResolver,
                audience,
                nonce,
            )

            expect(verified.sdJwt.iss).toBe('issuer.example')
            expect(verified.kbJwt.aud).toBe(audience)
        })

        it('should handle EdDSA issuer with RSA browser', async () => {
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
            ) // EdDSA issuer
            const presentationToken = await generatePresentationToken(
                sdJwt,
                audience,
                nonce,
                rsaBrowserKey,
            ) // RSA browser

            const verified = await verifyPresentationToken(
                presentationToken,
                keyResolver,
                audience,
                nonce,
            )

            expect(verified.sdJwt.iss).toBe('issuer.example')
            expect(verified.kbJwt.aud).toBe(audience)
        })
    })
})

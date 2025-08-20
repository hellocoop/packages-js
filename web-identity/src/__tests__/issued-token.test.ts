import { describe, it, expect } from 'vitest'
import {
    generateIssuedToken,
    verifyIssuedToken,
} from '../tokens/issued-token.js'
import type { IssuedTokenPayload, KeyResolver } from '../types.js'
import {
    MissingClaimError,
    EmailValidationError,
    TimeValidationError,
    InvalidSignatureError,
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

describe('IssuedToken Functions', () => {
    const browserPublicKey = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'browser-public-key-x-value',
        alg: 'EdDSA',
        kid: 'browser-key-1',
    }

    const testPayload: IssuedTokenPayload = {
        iss: 'issuer.example',
        cnf: {
            jwk: browserPublicKey,
        },
        email: 'user@example.com',
        email_verified: true,
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

    describe('generateIssuedToken', () => {
        it('should generate valid IssuedToken with RSA key', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)

            expect(token).toBeTypeOf('string')
            expect(token.split('.')).toHaveLength(3) // JWT format

            // Verify the token can be parsed and verified
            const verified = await verifyIssuedToken(token, keyResolver)
            expect(verified.iss).toBe(testPayload.iss)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.email_verified).toBe(true)
            expect(verified.cnf.jwk).toEqual(browserPublicKey)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should generate valid IssuedToken with EdDSA key', async () => {
            const token = await generateIssuedToken(
                testPayload,
                eddsaPrivateKey,
            )

            expect(token).toBeTypeOf('string')
            expect(token.split('.')).toHaveLength(3) // JWT format

            // Verify the token can be parsed and verified
            const verified = await verifyIssuedToken(token, keyResolver)
            expect(verified.iss).toBe(testPayload.iss)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.email_verified).toBe(true)
            expect(verified.cnf.jwk).toEqual(browserPublicKey)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should use provided iat when specified', async () => {
            const customIat = Math.floor(Date.now() / 1000) - 30 // 30 seconds ago
            const payloadWithIat = { ...testPayload, iat: customIat }

            const token = await generateIssuedToken(
                payloadWithIat,
                rsaPrivateKey,
            )
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.iat).toBe(customIat)
        })

        it('should strip private key material from cnf.jwk', async () => {
            const payloadWithPrivateKey = {
                ...testPayload,
                cnf: {
                    jwk: { ...browserPublicKey, d: 'private-key-material' },
                },
            }

            const token = await generateIssuedToken(
                payloadWithPrivateKey,
                rsaPrivateKey,
            )
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.cnf.jwk.d).toBeUndefined()
            expect(verified.cnf.jwk).toEqual(browserPublicKey)
        })

        it('should throw error for invalid email format', async () => {
            const invalidPayload = { ...testPayload, email: 'invalid-email' }

            await expect(
                generateIssuedToken(invalidPayload, rsaPrivateKey),
            ).rejects.toThrow(EmailValidationError)
        })

        it('should throw error for email_verified false', async () => {
            const unverifiedPayload = { ...testPayload, email_verified: false }

            await expect(
                generateIssuedToken(unverifiedPayload, rsaPrivateKey),
            ).rejects.toThrow(EmailValidationError)
        })

        it('should throw error for missing JWK algorithm', async () => {
            const { alg, ...keyWithoutAlg } = rsaPrivateKey

            await expect(
                generateIssuedToken(testPayload, keyWithoutAlg),
            ).rejects.toThrow()
        })

        it('should throw error for missing JWK kid', async () => {
            const { kid, ...keyWithoutKid } = rsaPrivateKey

            await expect(
                generateIssuedToken(testPayload, keyWithoutKid),
            ).rejects.toThrow()
        })

        it('should set correct JWT type and header', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)

            // Parse header manually to check
            const parts = token.split('.')
            const header = JSON.parse(
                Buffer.from(parts[0], 'base64url').toString(),
            )

            expect(header.typ).toBe('web-identity+sd-jwt')
            expect(header.kid).toBe(rsaPrivateKey.kid)
            expect(header.alg).toBe(rsaPrivateKey.alg)
        })
    })

    describe('verifyIssuedToken', () => {
        it('should verify valid RSA IssuedToken', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.iss).toBe(testPayload.iss)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.email_verified).toBe(true)
            expect(verified.cnf.jwk).toEqual(browserPublicKey)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should verify valid EdDSA IssuedToken', async () => {
            const token = await generateIssuedToken(
                testPayload,
                eddsaPrivateKey,
            )
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.iss).toBe(testPayload.iss)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.email_verified).toBe(true)
            expect(verified.cnf.jwk).toEqual(browserPublicKey)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should throw error for missing required claims', async () => {
            // Create a token with missing claims by manually constructing it
            const incompletePayload = {
                iss: 'issuer.example',
                email: 'user@example.com',
            }
            const header = {
                alg: 'RS256',
                typ: 'web-identity+sd-jwt',
                kid: rsaPrivateKey.kid,
            }

            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(incompletePayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(
                verifyIssuedToken(invalidToken, keyResolver),
            ).rejects.toThrow(MissingClaimError)
        })

        it('should throw error for invalid signature', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)

            // Tamper with the signature
            const parts = token.split('.')
            const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`

            await expect(
                verifyIssuedToken(tamperedToken, keyResolver),
            ).rejects.toThrow(InvalidSignatureError)
        })

        it('should throw error for expired token', async () => {
            const expiredPayload = {
                ...testPayload,
                iat: Math.floor(Date.now() / 1000) - 120,
            } // 2 minutes ago
            const token = await generateIssuedToken(
                expiredPayload,
                rsaPrivateKey,
            )

            await expect(verifyIssuedToken(token, keyResolver)).rejects.toThrow(
                TimeValidationError,
            )
        })

        it('should throw error for wrong JWT type', async () => {
            // Create a token with wrong type
            const header = { alg: 'RS256', typ: 'JWT', kid: rsaPrivateKey.kid }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(testPayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(
                verifyIssuedToken(invalidToken, keyResolver),
            ).rejects.toThrow()
        })

        it('should throw error for missing kid in header', async () => {
            const header = { alg: 'RS256', typ: 'web-identity+sd-jwt' }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(testPayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(
                verifyIssuedToken(invalidToken, keyResolver),
            ).rejects.toThrow(InvalidSignatureError)
        })

        it('should throw error for missing cnf.jwk claim', async () => {
            const { cnf, ...payloadWithoutCnf } = testPayload

            const header = {
                alg: 'RS256',
                typ: 'web-identity+sd-jwt',
                kid: rsaPrivateKey.kid,
            }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(payloadWithoutCnf),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(
                verifyIssuedToken(invalidToken, keyResolver),
            ).rejects.toThrow(MissingClaimError)
        })

        it('should throw error for email_verified false', async () => {
            const unverifiedPayload = { ...testPayload, email_verified: false }

            const header = {
                alg: 'RS256',
                typ: 'web-identity+sd-jwt',
                kid: rsaPrivateKey.kid,
            }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(unverifiedPayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(
                verifyIssuedToken(invalidToken, keyResolver),
            ).rejects.toThrow(EmailValidationError)
        })

        it('should throw error for unknown key ID', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)

            const unknownKeyResolver: KeyResolver = async (kid?: string) => {
                throw new Error(`Unknown key ID: ${kid}`)
            }

            await expect(
                verifyIssuedToken(token, unknownKeyResolver),
            ).rejects.toThrow('Unknown key ID')
        })

        it('should throw error for malformed JWT', async () => {
            const malformedToken = 'not.a.valid.jwt.format'

            await expect(
                verifyIssuedToken(malformedToken, keyResolver),
            ).rejects.toThrow()
        })
    })

    describe('Cross-algorithm compatibility', () => {
        it('should generate with RSA and verify correctly', async () => {
            const token = await generateIssuedToken(testPayload, rsaPrivateKey)
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified).toEqual(
                expect.objectContaining({
                    iss: testPayload.iss,
                    email: testPayload.email,
                    email_verified: testPayload.email_verified,
                    cnf: testPayload.cnf,
                }),
            )
        })

        it('should generate with EdDSA and verify correctly', async () => {
            const token = await generateIssuedToken(
                testPayload,
                eddsaPrivateKey,
            )
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified).toEqual(
                expect.objectContaining({
                    iss: testPayload.iss,
                    email: testPayload.email,
                    email_verified: testPayload.email_verified,
                    cnf: testPayload.cnf,
                }),
            )
        })

        it('should handle RSA issuer with EdDSA browser key', async () => {
            const eddsaBrowserKey = {
                kty: 'OKP',
                crv: 'Ed25519',
                x: 'different-browser-key-x',
                alg: 'EdDSA',
                kid: 'browser-eddsa-key',
            }

            const crossPayload = {
                ...testPayload,
                cnf: { jwk: eddsaBrowserKey },
            }

            const token = await generateIssuedToken(crossPayload, rsaPrivateKey)
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.cnf.jwk).toEqual(eddsaBrowserKey)
        })

        it('should handle EdDSA issuer with RSA browser key', async () => {
            const rsaBrowserKey = {
                kty: 'RSA',
                n: 'browser-rsa-n-value',
                e: 'AQAB',
                alg: 'RS256',
                kid: 'browser-rsa-key',
            }

            const crossPayload = {
                ...testPayload,
                cnf: { jwk: rsaBrowserKey },
            }

            const token = await generateIssuedToken(
                crossPayload,
                eddsaPrivateKey,
            )
            const verified = await verifyIssuedToken(token, keyResolver)

            expect(verified.cnf.jwk).toEqual(rsaBrowserKey)
        })
    })
})

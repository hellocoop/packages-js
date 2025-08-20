import { describe, it, expect } from 'vitest'
import {
    generateRequestToken,
    verifyRequestToken,
} from '../tokens/request-token.js'
import type { RequestTokenPayload } from '../types.js'
import {
    MissingClaimError,
    EmailValidationError,
    TimeValidationError,
    InvalidSignatureError,
} from '../errors.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test keys
const privateJwks = JSON.parse(
    readFileSync(join(__dirname, 'test-keys', 'private_jwks.json'), 'utf8'),
)

const rsaKey = privateJwks.keys.find((key: any) => key.kty === 'RSA')
const eddsaKey = privateJwks.keys.find((key: any) => key.kty === 'OKP')

describe('RequestToken Functions', () => {
    const testPayload: RequestTokenPayload = {
        aud: 'issuer.example',
        nonce: '259c5eae-486d-4b0f-b666-2a5b5ce1c925',
        email: 'user@example.com',
    }

    describe('generateRequestToken', () => {
        it('should generate valid RequestToken with RSA key', async () => {
            const token = await generateRequestToken(testPayload, rsaKey)

            expect(token).toBeTypeOf('string')
            expect(token.split('.')).toHaveLength(3) // JWT format

            // Verify the token can be parsed and verified
            const verified = await verifyRequestToken(token)
            expect(verified.aud).toBe(testPayload.aud)
            expect(verified.nonce).toBe(testPayload.nonce)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should generate valid RequestToken with EdDSA key', async () => {
            const token = await generateRequestToken(testPayload, eddsaKey)

            expect(token).toBeTypeOf('string')
            expect(token.split('.')).toHaveLength(3) // JWT format

            // Verify the token can be parsed and verified
            const verified = await verifyRequestToken(token)
            expect(verified.aud).toBe(testPayload.aud)
            expect(verified.nonce).toBe(testPayload.nonce)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should use provided iat when specified', async () => {
            const customIat = Math.floor(Date.now() / 1000) - 30 // 30 seconds ago
            const payloadWithIat = { ...testPayload, iat: customIat }

            const token = await generateRequestToken(payloadWithIat, rsaKey)
            const verified = await verifyRequestToken(token)

            expect(verified.iat).toBe(customIat)
        })

        it('should throw error for invalid email format', async () => {
            const invalidPayload = { ...testPayload, email: 'invalid-email' }

            await expect(
                generateRequestToken(invalidPayload, rsaKey),
            ).rejects.toThrow(EmailValidationError)
        })

        it('should throw error for missing JWK algorithm', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { alg: _alg, ...keyWithoutAlg } = rsaKey

            await expect(
                generateRequestToken(testPayload, keyWithoutAlg),
            ).rejects.toThrow()
        })

        it('should throw error for missing JWK kid', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { kid: _kid, ...keyWithoutKid } = rsaKey

            await expect(
                generateRequestToken(testPayload, keyWithoutKid),
            ).rejects.toThrow()
        })
    })

    describe('verifyRequestToken', () => {
        it('should verify valid RSA RequestToken', async () => {
            const token = await generateRequestToken(testPayload, rsaKey)
            const verified = await verifyRequestToken(token)

            expect(verified.aud).toBe(testPayload.aud)
            expect(verified.nonce).toBe(testPayload.nonce)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should verify valid EdDSA RequestToken', async () => {
            const token = await generateRequestToken(testPayload, eddsaKey)
            const verified = await verifyRequestToken(token)

            expect(verified.aud).toBe(testPayload.aud)
            expect(verified.nonce).toBe(testPayload.nonce)
            expect(verified.email).toBe(testPayload.email)
            expect(verified.iat).toBeTypeOf('number')
        })

        it('should throw error for missing required claims', async () => {
            // Create a token with missing claims by manually constructing it
            const incompletePayload = { aud: 'issuer.example' }
            const header = { alg: 'RS256', typ: 'JWT', jwk: rsaKey }

            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(incompletePayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(verifyRequestToken(invalidToken)).rejects.toThrow(
                MissingClaimError,
            )
        })

        it('should throw error for invalid signature', async () => {
            const token = await generateRequestToken(testPayload, rsaKey)

            // Tamper with the signature
            const parts = token.split('.')
            const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`

            await expect(verifyRequestToken(tamperedToken)).rejects.toThrow(
                InvalidSignatureError,
            )
        })

        it('should throw error for expired token', async () => {
            const expiredPayload = {
                ...testPayload,
                iat: Math.floor(Date.now() / 1000) - 120,
            } // 2 minutes ago
            const token = await generateRequestToken(expiredPayload, rsaKey)

            await expect(verifyRequestToken(token)).rejects.toThrow(
                TimeValidationError,
            )
        })

        it('should throw error for token without embedded public key', async () => {
            // Create a token without jwk in header
            const header = { alg: 'RS256', typ: 'JWT' }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(testPayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(verifyRequestToken(invalidToken)).rejects.toThrow(
                InvalidSignatureError,
            )
        })

        it('should throw error for invalid email in payload', async () => {
            const invalidEmailPayload = {
                ...testPayload,
                email: 'invalid-email',
            }

            // We need to manually create this token since generateRequestToken would reject it
            const header = { alg: 'RS256', typ: 'JWT', jwk: rsaKey }
            const headerB64 = Buffer.from(JSON.stringify(header)).toString(
                'base64url',
            )
            const payloadB64 = Buffer.from(
                JSON.stringify(invalidEmailPayload),
            ).toString('base64url')
            const invalidToken = `${headerB64}.${payloadB64}.invalid-signature`

            await expect(verifyRequestToken(invalidToken)).rejects.toThrow(
                EmailValidationError,
            )
        })

        it('should throw error for malformed JWT', async () => {
            const malformedToken = 'not.a.valid.jwt.format'

            await expect(verifyRequestToken(malformedToken)).rejects.toThrow()
        })
    })

    describe('Cross-algorithm compatibility', () => {
        it('should generate with RSA and verify correctly', async () => {
            const token = await generateRequestToken(testPayload, rsaKey)
            const verified = await verifyRequestToken(token)

            expect(verified).toEqual(expect.objectContaining(testPayload))
        })

        it('should generate with EdDSA and verify correctly', async () => {
            const token = await generateRequestToken(testPayload, eddsaKey)
            const verified = await verifyRequestToken(token)

            expect(verified).toEqual(expect.objectContaining(testPayload))
        })
    })
})

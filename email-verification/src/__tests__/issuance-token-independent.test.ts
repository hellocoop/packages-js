import { describe, it, expect } from 'vitest'
import { generateIssuanceToken } from '../tokens/issuance-token.js'
import { verifyIssuanceTokenIndependent } from './independent-verify.js'
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

describe('IssuanceToken Independent Verification', () => {
    const browserPublicKey = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'browser-public-key-x-value',
        alg: 'EdDSA',
        kid: 'browser-key-1',
    }

    const testPayload: IssuanceTokenPayload = {
        iss: 'issuer.example',
        cnf: {
            jwk: browserPublicKey,
        },
        email: 'user@example.com',
        email_verified: true,
    }

    it('should generate and independently verify RSA IssuanceToken', async () => {
        const token = await generateIssuanceToken(testPayload, rsaPrivateKey)

        const verification = await verifyIssuanceTokenIndependent(
            token,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(true)
        expect(verification.errors).toHaveLength(0)
        expect(verification.payload.iss).toBe(testPayload.iss)
        expect(verification.payload.email).toBe(testPayload.email)
        expect(verification.payload.email_verified).toBe(true)
        expect(verification.payload.cnf.jwk).toEqual(browserPublicKey)
        expect(verification.payload.iat).toBeTypeOf('number')
    })

    it('should generate and independently verify EdDSA IssuanceToken', async () => {
        const token = await generateIssuanceToken(testPayload, eddsaPrivateKey)

        const verification = await verifyIssuanceTokenIndependent(
            token,
            eddsaPublicKey,
        )

        expect(verification.valid).toBe(true)
        expect(verification.errors).toHaveLength(0)
        expect(verification.payload.iss).toBe(testPayload.iss)
        expect(verification.payload.email).toBe(testPayload.email)
        expect(verification.payload.email_verified).toBe(true)
        expect(verification.payload.cnf.jwk).toEqual(browserPublicKey)
        expect(verification.payload.iat).toBeTypeOf('number')
    })

    it('should detect invalid signature in independent verification', async () => {
        const token = await generateIssuanceToken(testPayload, rsaPrivateKey)

        // Tamper with the token
        const parts = token.split('.')
        const tamperedPayload = Buffer.from(
            JSON.stringify({ ...testPayload, email: 'tampered@example.com' }),
        ).toString('base64url')
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

        const verification = await verifyIssuanceTokenIndependent(
            tamperedToken,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(false)
        expect(verification.errors).toContain('Invalid signature')
    })

    it('should detect missing claims in independent verification', async () => {
        const incompletePayload = {
            iss: 'issuer.example',
            email: 'user@example.com',
        }

        // We expect this to fail during generation due to missing claims
        await expect(
            generateIssuanceToken(incompletePayload as any, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should detect invalid email format in independent verification', async () => {
        const invalidEmailPayload = { ...testPayload, email: 'invalid-email' }

        // This should fail during generation due to email validation
        await expect(
            generateIssuanceToken(invalidEmailPayload, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should detect email_verified false in independent verification', async () => {
        const unverifiedPayload = { ...testPayload, email_verified: false }

        // This should fail during generation due to email_verified validation
        await expect(
            generateIssuanceToken(unverifiedPayload, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should handle expired tokens in independent verification', async () => {
        const expiredPayload = {
            ...testPayload,
            iat: Math.floor(Date.now() / 1000) - 120,
        } // 2 minutes ago

        const token = await generateIssuanceToken(expiredPayload, rsaPrivateKey)
        const verification = await verifyIssuanceTokenIndependent(
            token,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(false)
        expect(
            verification.errors.some((error) =>
                error.includes('iat claim outside acceptable window'),
            ),
        ).toBe(true)
    })

    it('should validate JWT type is evt+jwt', async () => {
        const token = await generateIssuanceToken(testPayload, rsaPrivateKey)

        // Manually parse to check the header
        const parts = token.split('.')
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())

        expect(header.typ).toBe('evt+jwt')
        expect(header.kid).toBe(rsaPrivateKey.kid)
        expect(header.alg).toBe(rsaPrivateKey.alg)
    })

    it('should ensure cnf.jwk contains only public key parameters', async () => {
        const payloadWithPrivateKey = {
            ...testPayload,
            cnf: {
                jwk: { ...browserPublicKey, d: 'private-key-material' },
            },
        }

        const token = await generateIssuanceToken(
            payloadWithPrivateKey,
            rsaPrivateKey,
        )
        const verification = await verifyIssuanceTokenIndependent(
            token,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(true)
        expect(verification.payload.cnf.jwk.d).toBeUndefined() // Private key material should be stripped
    })

    it('should cross-verify RSA issuer with EdDSA browser key', async () => {
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

        const token = await generateIssuanceToken(crossPayload, rsaPrivateKey)
        const verification = await verifyIssuanceTokenIndependent(
            token,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(true)
        expect(verification.payload.cnf.jwk).toEqual(eddsaBrowserKey)
    })
})

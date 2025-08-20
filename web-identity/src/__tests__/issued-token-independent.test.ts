import { describe, it, expect } from 'vitest'
import { generateIssuedToken } from '../tokens/issued-token.js'
import { verifyIssuedTokenIndependent } from './independent-verify.js'
import type { IssuedTokenPayload } from '../types.js'
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

describe('IssuedToken Independent Verification', () => {
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

    it('should generate and independently verify RSA IssuedToken', async () => {
        const token = await generateIssuedToken(testPayload, rsaPrivateKey)

        const verification = await verifyIssuedTokenIndependent(
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

    it('should generate and independently verify EdDSA IssuedToken', async () => {
        const token = await generateIssuedToken(testPayload, eddsaPrivateKey)

        const verification = await verifyIssuedTokenIndependent(
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
        const token = await generateIssuedToken(testPayload, rsaPrivateKey)

        // Tamper with the token
        const parts = token.split('.')
        const tamperedPayload = Buffer.from(
            JSON.stringify({ ...testPayload, email: 'tampered@example.com' }),
        ).toString('base64url')
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

        const verification = await verifyIssuedTokenIndependent(
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
            generateIssuedToken(incompletePayload as any, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should detect invalid email format in independent verification', async () => {
        const invalidEmailPayload = { ...testPayload, email: 'invalid-email' }

        // This should fail during generation due to email validation
        await expect(
            generateIssuedToken(invalidEmailPayload, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should detect email_verified false in independent verification', async () => {
        const unverifiedPayload = { ...testPayload, email_verified: false }

        // This should fail during generation due to email_verified validation
        await expect(
            generateIssuedToken(unverifiedPayload, rsaPrivateKey),
        ).rejects.toThrow()
    })

    it('should handle expired tokens in independent verification', async () => {
        const expiredPayload = {
            ...testPayload,
            iat: Math.floor(Date.now() / 1000) - 120,
        } // 2 minutes ago

        const token = await generateIssuedToken(expiredPayload, rsaPrivateKey)
        const verification = await verifyIssuedTokenIndependent(
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

    it('should validate JWT type is web-identity+sd-jwt', async () => {
        const token = await generateIssuedToken(testPayload, rsaPrivateKey)

        // Manually parse to check the header
        const parts = token.split('.')
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())

        expect(header.typ).toBe('web-identity+sd-jwt')
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

        const token = await generateIssuedToken(
            payloadWithPrivateKey,
            rsaPrivateKey,
        )
        const verification = await verifyIssuedTokenIndependent(
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

        const token = await generateIssuedToken(crossPayload, rsaPrivateKey)
        const verification = await verifyIssuedTokenIndependent(
            token,
            rsaPublicKey,
        )

        expect(verification.valid).toBe(true)
        expect(verification.payload.cnf.jwk).toEqual(eddsaBrowserKey)
    })
})

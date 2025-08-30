import { describe, it, expect } from 'vitest'
import { generateRequestToken } from '../tokens/request-token.js'
import { verifyRequestTokenIndependent } from './independent-verify.js'
import type { RequestTokenPayload } from '../types.js'
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

describe('RequestToken Independent Verification', () => {
    const testPayload: RequestTokenPayload = {
        aud: 'issuer.example',
        nonce: '259c5eae-486d-4b0f-b666-2a5b5ce1c925',
        email: 'user@example.com',
    }

    it('should generate and independently verify RSA RequestToken', async () => {
        const token = await generateRequestToken(testPayload, rsaKey)

        const verification = await verifyRequestTokenIndependent(token)

        expect(verification.valid).toBe(true)
        expect(verification.errors).toHaveLength(0)
        expect(verification.payload.aud).toBe(testPayload.aud)
        expect(verification.payload.nonce).toBe(testPayload.nonce)
        expect(verification.payload.email).toBe(testPayload.email)
        expect(verification.payload.iat).toBeTypeOf('number')
    })

    it('should generate and independently verify EdDSA RequestToken', async () => {
        const token = await generateRequestToken(testPayload, eddsaKey)

        const verification = await verifyRequestTokenIndependent(token)

        expect(verification.valid).toBe(true)
        expect(verification.errors).toHaveLength(0)
        expect(verification.payload.aud).toBe(testPayload.aud)
        expect(verification.payload.nonce).toBe(testPayload.nonce)
        expect(verification.payload.email).toBe(testPayload.email)
        expect(verification.payload.iat).toBeTypeOf('number')
    })

    it('should detect invalid signature in independent verification', async () => {
        const token = await generateRequestToken(testPayload, rsaKey)

        // Tamper with the token
        const parts = token.split('.')
        const tamperedPayload = Buffer.from(
            JSON.stringify({ ...testPayload, email: 'tampered@example.com' }),
        ).toString('base64url')
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

        const verification = await verifyRequestTokenIndependent(tamperedToken)

        expect(verification.valid).toBe(false)
        expect(verification.errors).toContain('Invalid signature')
    })

    it('should detect missing claims in independent verification', async () => {
        const incompletePayload = { aud: 'issuer.example' }

        // We expect this to fail during generation due to missing claims
        await expect(
            generateRequestToken(incompletePayload as any, rsaKey),
        ).rejects.toThrow()
    })

    it('should detect invalid email format in independent verification', async () => {
        const invalidEmailPayload = { ...testPayload, email: 'invalid-email' }

        // This should fail during generation due to email validation
        await expect(
            generateRequestToken(invalidEmailPayload, rsaKey),
        ).rejects.toThrow()
    })

    it('should handle expired tokens in independent verification', async () => {
        const expiredPayload = {
            ...testPayload,
            iat: Math.floor(Date.now() / 1000) - 120,
        } // 2 minutes ago

        const token = await generateRequestToken(expiredPayload, rsaKey)
        const verification = await verifyRequestTokenIndependent(token)

        expect(verification.valid).toBe(false)
        expect(
            verification.errors.some((error) =>
                error.includes('iat claim outside acceptable window'),
            ),
        ).toBe(true)
    })
})

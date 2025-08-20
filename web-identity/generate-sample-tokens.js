import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
    generateRequestToken,
    verifyRequestToken,
    generateIssuedToken,
    generatePresentationToken,
} from './dist/esm/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test keys
const privateJwks = JSON.parse(
    readFileSync(
        join(__dirname, 'src/__tests__/test-keys/private_jwks.json'),
        'utf8',
    ),
)

const rsaPrivateKey = privateJwks.keys.find((key) => key.kty === 'RSA')
const eddsaPrivateKey = privateJwks.keys.find((key) => key.kty === 'OKP')

async function generateSampleTokens() {
    console.log('🔐 Generating Sample Web Identity Tokens\n')

    // Browser keys for testing
    const browserKey = { ...eddsaPrivateKey, kid: 'browser-key-sample' }
    const issuerKey = { ...rsaPrivateKey, kid: 'issuer-key-sample' }

    try {
        // 1. Generate RequestToken
        console.log('1️⃣ Generating RequestToken...')
        const requestTokenPayload = {
            aud: 'issuer.example',
            nonce: 'sample-nonce-12345',
            email: 'user@example.com',
        }

        const requestToken = await generateRequestToken(
            requestTokenPayload,
            browserKey,
        )
        console.log('✅ RequestToken generated:')
        console.log(requestToken)
        console.log()

        // Verify the RequestToken
        const verifiedRequest = await verifyRequestToken(requestToken)
        console.log('✅ RequestToken verified successfully:')
        console.log(JSON.stringify(verifiedRequest, null, 2))
        console.log()

        // 2. Generate IssuedToken (SD-JWT)
        console.log('2️⃣ Generating IssuedToken (SD-JWT)...')
        const issuedTokenPayload = {
            iss: 'issuer.example',
            cnf: {
                jwk: {
                    kty: browserKey.kty,
                    crv: browserKey.crv,
                    x: browserKey.x,
                    alg: browserKey.alg,
                    kid: browserKey.kid,
                },
            },
            email: verifiedRequest.email,
            email_verified: true,
        }

        const issuedToken = await generateIssuedToken(
            issuedTokenPayload,
            issuerKey,
        )
        console.log('✅ IssuedToken (SD-JWT) generated:')
        console.log(issuedToken)
        console.log()

        // 3. Generate PresentationToken (SD-JWT+KB)
        console.log('3️⃣ Generating PresentationToken (SD-JWT+KB)...')
        const audience = 'https://rp.example'
        const presentationNonce = 'presentation-nonce-67890'

        const presentationToken = await generatePresentationToken(
            issuedToken,
            audience,
            presentationNonce,
            browserKey,
        )

        console.log('✅ PresentationToken (SD-JWT+KB) generated:')
        console.log(presentationToken)
        console.log()

        // Parse the PresentationToken to show its components
        const [sdJwtPart, kbJwtPart] = presentationToken.split('~')
        console.log('📋 PresentationToken Components:')
        console.log('SD-JWT part:', sdJwtPart)
        console.log('KB-JWT part:', kbJwtPart)
        console.log()

        console.log('🎉 All tokens generated successfully!')
        console.log('\n📝 Token Summary:')
        console.log(`- RequestToken: ${requestToken.length} characters`)
        console.log(`- IssuedToken: ${issuedToken.length} characters`)
        console.log(
            `- PresentationToken: ${presentationToken.length} characters`,
        )
    } catch (error) {
        console.error('❌ Error generating tokens:', error)
    }
}

generateSampleTokens()

#!/usr/bin/env node

/**
 * Test script for Verified Email Autocomplete protocol
 *
 * This script simulates the browser's role in the verified email autocomplete flow
 * as defined in https://github.com/dickhardt/verified-email-autocomplete
 *
 * Usage: npx @hellocoop/web-identity <email> <cookie_name> <cookie_value>
 *
 * Flow:
 * 1. Discover issuer from email domain via DNS
 * 2. Fetch issuer metadata (JWKS URI and issuance endpoint)
 * 3. Generate request token (simulating browser)
 * 4. Send request token to issuance endpoint with cookie
 * 5. Verify and pretty print the returned SD-JWT
 */

import { generateKeyPair, exportJWK } from 'jose'
import {
    discoverIssuer,
    fetchWebIdentityMetadata,
    generateRequestToken,
    verifyIssuanceToken,
    fetchJWKS,
} from './dist/esm/index.js'

// ANSI color codes for pretty output
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
}

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
    log(
        `\n${colors.bold}[Step ${step}]${colors.reset} ${colors.cyan}${message}${colors.reset}`,
    )
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green')
}

function logError(message) {
    log(`✗ ${message}`, 'red')
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow')
}

function prettyPrintJWT(token, title) {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format')
        }

        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString(),
        )

        log(`\n${colors.bold}${title}${colors.reset}`)
        log('Header:', 'blue')
        console.log(JSON.stringify(header, null, 2))
        log('Payload:', 'blue')
        console.log(JSON.stringify(payload, null, 2))
        log('Signature:', 'blue')
        console.log(`${parts[2].substring(0, 20)}...`)
    } catch (error) {
        logError(`Failed to parse JWT: ${error.message}`)
    }
}

function printHelp() {
    console.log(`
${colors.bold}Verified Email Autocomplete Test Script${colors.reset}

This script simulates the browser's role in the verified email autocomplete flow.

${colors.bold}Usage:${colors.reset}
  npx @hellocoop/web-identity <email> <cookie_name> <cookie_value>

${colors.bold}Parameters:${colors.reset}
  email        - Email address to verify (e.g., dick@blame.ca)
  cookie_name  - Name of the authentication cookie (e.g., user-hint)
  cookie_value - Value of the authentication cookie

${colors.bold}Example:${colors.reset}
  npx @hellocoop/web-identity dick@blame.ca user-hint abc123def456

${colors.bold}Flow:${colors.reset}
  1. Discover issuer from email domain via DNS TXT record
  2. Fetch issuer's web-identity metadata (JWKS URI and issuance endpoint)
  3. Generate a request token (simulating browser key pair)
  4. Send request token to issuance endpoint with authentication cookie
  5. Verify and pretty print the returned SD-JWT token

${colors.bold}Requirements:${colors.reset}
  - Email domain must have DNS TXT record: email._web-identity.<domain>
  - Issuer must have /.well-known/web-identity metadata endpoint
  - Issuer must have working issuance endpoint that accepts a cookie for user authentication
`)
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printHelp()
        process.exit(0)
    }

    if (args.length !== 3) {
        logError('Invalid number of arguments')
        printHelp()
        process.exit(1)
    }

    const [email, cookieName, cookieValue] = args

    log(
        `${colors.bold}Testing Verified Email Autocomplete Protocol${colors.reset}`,
    )
    log(`Email: ${email}`)
    log(`Cookie: ${cookieName}=${cookieValue.substring(0, 10)}...`)

    try {
        // Step 1: Discover issuer from email domain
        logStep(1, 'Discovering issuer from email domain')
        log(
            `Looking up DNS TXT record for: email._web-identity.${email.split('@')[1]}`,
        )

        let issuer
        try {
            issuer = await discoverIssuer(email)
            logSuccess(`Found issuer: ${issuer}`)
        } catch (error) {
            logError(`Issuer discovery failed: ${error.message}`)
            process.exit(1)
        }

        // Step 2: Fetch issuer metadata
        logStep(2, 'Fetching issuer metadata')
        log(
            `Fetching metadata from: https://${issuer}/.well-known/web-identity`,
        )

        let metadata
        try {
            metadata = await fetchWebIdentityMetadata(issuer)
            logSuccess('Metadata fetched successfully')
            log('Issuance Endpoint:', 'blue')
            console.log(`  ${metadata.issuance_endpoint}`)
            log('JWKS URI:', 'blue')
            console.log(`  ${metadata.jwks_uri}`)
        } catch (error) {
            logError(`Metadata fetch failed: ${error.message}`)
            process.exit(1)
        }

        // Step 3: Fetch JWKS for later verification
        logStep(3, 'Fetching issuer JWKS')
        let jwks
        try {
            jwks = await fetchJWKS(metadata.jwks_uri)
            logSuccess(`Fetched JWKS with ${jwks.keys.length} keys`)

            // Display supported algorithms
            const supportedAlgorithms = new Set()
            jwks.keys.forEach((key) => {
                if (key.alg) {
                    supportedAlgorithms.add(key.alg)
                }
            })

            log('Supported algorithms:', 'blue')
            supportedAlgorithms.forEach((alg) => {
                console.log(`  - ${alg}`)
            })

            if (supportedAlgorithms.size === 0) {
                logWarning(
                    'No algorithms specified in JWKS, will use EdDSA as default',
                )
            }
        } catch (error) {
            logError(`JWKS fetch failed: ${error.message}`)
            process.exit(1)
        }

        // Step 4: Generate browser key pair (simulating browser)
        logStep(4, 'Generating browser key pair compatible with issuer')

        // Determine which algorithm to use based on issuer support
        const supportedAlgorithms = new Set()
        jwks.keys.forEach((key) => {
            if (key.alg) {
                supportedAlgorithms.add(key.alg)
            }
        })

        // Algorithm preference order (most secure first)
        const preferredAlgorithms = [
            'EdDSA',
            'ES256',
            'ES384',
            'ES512',
            'RS256',
            'RS384',
            'RS512',
        ]
        let chosenAlgorithm = null

        for (const alg of preferredAlgorithms) {
            if (supportedAlgorithms.has(alg)) {
                chosenAlgorithm = alg
                break
            }
        }

        // Fallback to EdDSA if no algorithm specified in JWKS
        if (!chosenAlgorithm) {
            chosenAlgorithm = 'EdDSA'
            logWarning(
                'No supported algorithm found in JWKS, defaulting to EdDSA',
            )
        }

        log(`Selected algorithm: ${chosenAlgorithm}`, 'cyan')

        let keyPair, browserJWK
        try {
            // Generate key pair based on chosen algorithm
            switch (chosenAlgorithm) {
                case 'EdDSA':
                    keyPair = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
                    break
                case 'ES256':
                    keyPair = await generateKeyPair('ES256')
                    break
                case 'ES384':
                    keyPair = await generateKeyPair('ES384')
                    break
                case 'ES512':
                    keyPair = await generateKeyPair('ES512')
                    break
                case 'RS256':
                case 'RS384':
                case 'RS512':
                    keyPair = await generateKeyPair('RS256', {
                        modulusLength: 2048,
                    })
                    break
                default:
                    throw new Error(`Unsupported algorithm: ${chosenAlgorithm}`)
            }

            browserJWK = await exportJWK(keyPair.privateKey)
            browserJWK.alg = chosenAlgorithm
            browserJWK.use = 'sig'
            browserJWK.kid = crypto.randomUUID() // Add key identifier

            const keyType =
                browserJWK.kty === 'OKP'
                    ? `${browserJWK.crv}`
                    : browserJWK.kty === 'EC'
                      ? `${browserJWK.crv}`
                      : browserJWK.kty === 'RSA'
                        ? `RSA-${browserJWK.n ? Math.ceil(Math.log2(Buffer.from(browserJWK.n, 'base64url').length * 8)) : '2048'}`
                        : browserJWK.kty

            logSuccess(
                `Generated ${keyType} key pair with ${chosenAlgorithm} algorithm`,
            )
        } catch (error) {
            logError(`Key generation failed: ${error.message}`)
            process.exit(1)
        }

        // Step 5: Create request token
        logStep(5, 'Creating request token')
        const nonce = crypto.randomUUID()
        const requestPayload = {
            aud: issuer,
            nonce: nonce,
            email: email,
            iat: Math.floor(Date.now() / 1000),
        }

        let requestToken
        try {
            requestToken = await generateRequestToken(
                requestPayload,
                browserJWK,
            )
            logSuccess('Request token created')
            prettyPrintJWT(requestToken, 'Request Token')
        } catch (error) {
            logError(`Request token generation failed: ${error.message}`)
            process.exit(1)
        }

        // Step 6: Send request to issuance endpoint
        logStep(6, 'Sending request to issuance endpoint')
        log(`POST ${metadata.issuance_endpoint}`)
        log(`Cookie: ${cookieName}=${cookieValue.substring(0, 10)}...`)

        let response
        try {
            response = await fetch(metadata.issuance_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `${cookieName}=${cookieValue}`,
                },
                body: JSON.stringify({
                    request_token: requestToken,
                }),
            })

            log(`Response Status: ${response.status} ${response.statusText}`)

            if (!response.ok) {
                const errorText = await response.text()
                logError(`HTTP ${response.status}: ${errorText}`)
                process.exit(1)
            }
        } catch (error) {
            logError(`Request failed: ${error.message}`)
            process.exit(1)
        }

        // Step 7: Parse response
        logStep(7, 'Processing response')
        let responseData
        try {
            const contentType = response.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                logWarning(`Unexpected content type: ${contentType}`)
            }

            responseData = await response.json()

            if (!responseData.issuance_token) {
                logError('Response missing issuance_token field')
                console.log('Response body:', responseData)
                process.exit(1)
            }

            logSuccess('Received issuance token')
        } catch (error) {
            logError(`Response parsing failed: ${error.message}`)
            process.exit(1)
        }

        // Step 8: Verify and display the issuance token
        logStep(8, 'Verifying issuance token (SD-JWT)')
        const issuanceToken = responseData.issuance_token
        prettyPrintJWT(issuanceToken, 'Issuance Token (SD-JWT)')

        try {
            // Create a key resolver that uses the fetched JWKS
            const keyResolver = async (kid) => {
                const key = jwks.keys.find((k) => k.kid === kid)
                if (!key) {
                    throw new Error(`Key not found: ${kid}`)
                }
                return key
            }

            const verifiedToken = await verifyIssuanceToken(
                issuanceToken,
                keyResolver,
                issuer,
            )
            logSuccess('Token verification successful!')

            log('\nVerified Token Claims:', 'blue')
            console.log(JSON.stringify(verifiedToken, null, 2))

            // Validate the email matches
            if (verifiedToken.email === email) {
                logSuccess(`Email verified: ${verifiedToken.email}`)
            } else {
                logError(
                    `Email mismatch: expected ${email}, got ${verifiedToken.email}`,
                )
            }

            if (verifiedToken.email_verified === true) {
                logSuccess('Email verification status: true')
            } else {
                logError(
                    `Email verification status: ${verifiedToken.email_verified}`,
                )
            }
        } catch (error) {
            logError(`Token verification failed: ${error.message}`)
            process.exit(1)
        }

        logStep('✓', 'Verified Email Autocomplete flow completed successfully!')
        log(
            '\nThe browser would now create a presentation token (SD-JWT+KB) and send it to the RP.',
            'cyan',
        )
    } catch (error) {
        logError(`Unexpected error: ${error.message}`)
        console.error(error.stack)
        process.exit(1)
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logError(`Unhandled Promise Rejection: ${reason}`)
    process.exit(1)
})

main().catch((error) => {
    logError(`Script failed: ${error.message}`)
    process.exit(1)
})

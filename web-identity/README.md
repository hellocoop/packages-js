# @hellocoop/web-identity

⚠️ **DEPRECATED** - This package has been superseded by [@hellocoop/email-verification](https://www.npmjs.com/package/@hellocoop/email-verification).

> **Development Note**: This package was collaboratively developed using spec-driven development with AI assistance. You can view the complete [requirements, design, and implementation specifications](https://github.com/hellocoop/packages-js/tree/main/web-identity/specs) that guided the development process.

TypeScript functions for generating and verifying JWT tokens used in the Verified Email Autocomplete protocol. This package provides complete implementations for RequestToken, IssuanceToken (SD-JWT), and PresentationToken (SD-JWT+KB) as defined in the [web-identity specification](https://github.com/dickhardt/verified-email-autocomplete).

## 🚀 Try It Live with Hellō

Want to see the Verified Email Autocomplete protocol in action? You can test it right now with hello.coop!

### Quick Test Setup

1. **Add DNS Record**: Add this TXT record to your domain:

    ```
    email._web-identity.yourdomain.com TXT "iss=hello.coop"
    ```

2. **Get User Hint Cookie**: Visit [Hellō Wallet](https://wallet.hello.coop), create a wallet if needed by logging in, and verify an email address at your domain. In your browser, inspect the page, select the application tab, and find the `user-hint` cookie for wallet.hello.coop, and get its value.

3. **Run the Test**: Use npx to test the complete flow:
    ```bash
    npx @hellocoop/web-identity your-email@yourdomain.com user-hint <cookie-value>
    ```

### Example

```bash
# After setting up DNS and getting your user-hint cookie
npx @hellocoop/web-identity john@example.com user-hint eyJhbGciOiJFZERTQSJ9...
```

This will:

- ✅ Discover the issuer (hello.coop) via DNS
- ✅ Fetch hello.coop web-identity metadata and JWKS
- ✅ Generate a request token with a browser key pair
- ✅ Send the request to hello.coop issuance endpoint
- ✅ Verify and display the returned SD-JWT token

Perfect for testing your DNS setup and seeing the protocol in action! 🎯

## Package Installation

```bash
npm install @hellocoop/web-identity
```

## Quick Start

### ESM (ECMAScript Modules)

```typescript
import {
    // Most commonly used by RPs
    verifyPresentationToken,

    // Other token functions
    generateRequestToken,
    verifyRequestToken,
    generateIssuanceToken,
    verifyIssuanceToken,
    generatePresentationToken,

    // DNS discovery functions
    discoverIssuer,
    fetchWebIdentityMetadata,
    fetchJWKS,
    clearCaches,

    // Types
    type KeyResolver,
    type WebIdentityMetadata,
    type JWKSResponse,
    type RequestOptions,
} from '@hellocoop/web-identity'
```

### CommonJS

```javascript
const {
    // Most commonly used by RPs
    verifyPresentationToken,

    // Other token functions
    generateRequestToken,
    verifyRequestToken,
    generateIssuanceToken,
    verifyIssuanceToken,
    generatePresentationToken,

    // Discovery functions
    discoverIssuer,
    fetchWebIdentityMetadata,
    fetchJWKS,
    clearCaches,
} = require('@hellocoop/web-identity')
```

**Note**: The package provides dual ESM/CommonJS support with automatic module resolution based on your project configuration.

## API Reference

### PresentationToken Verification (Most Common for RPs)

#### `verifyPresentationToken(token, expectedAudience, expectedNonce, keyResolver?)`

**🔥 Most commonly used function by Relying Parties** - Verifies a PresentationToken (SD-JWT+KB) from browsers with automatic DNS-based key discovery.

**Parameters:**

- `token: string` - SD-JWT+KB string to verify
- `expectedAudience: string` - Expected audience (RP's origin)
- `expectedNonce: string` - Expected nonce from RP's session
- `keyResolver?: KeyResolver` - Optional function to resolve issuer's public key. If not provided, uses automatic DNS discovery

**Returns:** `Promise<PresentationTokenPayload>` - Object containing both SD-JWT and KB-JWT payloads

**Example (Automatic DNS Discovery - Recommended):**

```typescript
// Simplest usage - automatic key discovery via DNS
const verified = await verifyPresentationToken(
    presentationToken,
    'https://rp.example',
    'session-nonce-123',
)

console.log(verified.sdJwt.email) // 'user@example.com'
console.log(verified.kbJwt.aud) // 'https://rp.example'
```

**Example (Custom Key Resolver):**

```typescript
// Custom key resolver for advanced use cases
const keyResolver = async (kid, issuer) => {
    // Your custom logic to resolve keys
    return await getPublicKeyFromSomewhere(kid, issuer)
}

const verified = await verifyPresentationToken(
    presentationToken,
    'https://rp.example',
    'session-nonce-123',
    keyResolver,
)
```

### RequestToken Functions

RequestTokens are used by browsers to request verified email tokens from issuers (step 3.4 & 4.1).

#### `generateRequestToken(payload, jwk, options?)`

Generates a RequestToken (JWT) with an embedded public key.

**Parameters:**

- `payload: RequestTokenPayload` - Token payload
    - `aud: string` - Audience (issuer domain)
    - `nonce: string` - Nonce provided by the RP
    - `email: string` - Email address to be verified
    - `iat?: number` - Optional issued at time (defaults to current time)
- `jwk: JWK` - JSON Web Key containing private key, algorithm, and key ID
- `options?: TokenGenerationOptions` - Optional generation options

**Returns:** `Promise<string>` - Signed JWT string

**Example:**

```typescript
const requestToken = await generateRequestToken(
    {
        aud: 'issuer.example',
        nonce: '259c5eae-486d-4b0f-b666-2a5b5ce1c925',
        email: 'user@example.com',
    },
    browserPrivateKey,
)
```

#### `verifyRequestToken(token)`

Verifies a RequestToken using the embedded public key.

**Parameters:**

- `token: string` - JWT string to verify

**Returns:** `Promise<RequestTokenPayload>` - Verified payload

**Example:**

```typescript
const verified = await verifyRequestToken(requestToken)
console.log(verified.email) // 'user@example.com'
```

**Note:** RequestTokens contain the public key embedded in the JWT header, so no external key resolver is needed.

### IssuanceToken Functions

IssuanceTokens (SD-JWTs) are used by issuers to provide verified email tokens to browsers (step 4.2 & 5.1).

#### `generateIssuanceToken(payload, jwk, options?)`

Generates an IssuanceToken (SD-JWT) for verified email addresses.

**Parameters:**

- `payload: IssuanceTokenPayload` - Token payload
    - `iss: string` - Issuer identifier
    - `cnf: { jwk: JWK }` - Confirmation claim with browser's public key
    - `email: string` - Verified email address
    - `email_verified: boolean` - Must be `true`
    - `iat?: number` - Optional issued at time
- `jwk: JWK` - Issuer's private key
- `options?: TokenGenerationOptions` - Optional generation options

**Returns:** `Promise<string>` - Signed SD-JWT string

**Example:**

```typescript
const issuanceToken = await generateIssuanceToken(
    {
        iss: 'issuer.example',
        cnf: { jwk: browserPublicKey },
        email: 'user@example.com',
        email_verified: true,
    },
    issuerPrivateKey,
)
```

#### `verifyIssuanceToken(token, keyResolver)`

Verifies an IssuanceToken (SD-JWT) from issuers.

**Parameters:**

- `token: string` - SD-JWT string to verify
- `keyResolver: KeyResolver` - Function to resolve issuer's public key

**Returns:** `Promise<IssuanceTokenPayload>` - Verified payload

**Example:**

```typescript
const keyResolver: KeyResolver = async (kid, issuer) => {
    // Return the appropriate public key for verification
    return await getIssuerPublicKey(kid, issuer)
}

const verified = await verifyIssuanceToken(issuanceToken, keyResolver)
```

### PresentationToken Functions

PresentationTokens (SD-JWT+KB) are used by browsers to present verified email tokens to relying parties (step 5.2 & 6.2-6.4).

#### `generatePresentationToken(sdJwt, audience, nonce, jwk, options?)`

Generates a PresentationToken (SD-JWT+KB) with key binding.

**Parameters:**

- `sdJwt: string` - SD-JWT from issuer
- `audience: string` - RP's origin
- `nonce: string` - Nonce from RP's session
- `jwk: JWK` - Browser's private key
- `options?: TokenGenerationOptions` - Optional generation options

**Returns:** `Promise<string>` - SD-JWT+KB string (format: `{SD-JWT}~{KB-JWT}`)

**Example:**

```typescript
const presentationToken = await generatePresentationToken(
    issuanceToken,
    'https://rp.example',
    'session-nonce-123',
    browserPrivateKey,
)
```

### DNS Discovery Functions

The package provides DNS-based discovery functions to automatically find issuers and fetch their metadata according to the Verified Email Autocomplete specification.

#### `discoverIssuer(emailOrDomain)`

Discovers the web-identity issuer for an email address or domain via DNS TXT record lookup.

**Parameters:**

- `emailOrDomain: string` - Email address (e.g., `user@example.com`) or domain (e.g., `example.com`)

**Returns:** `Promise<string>` - Issuer identifier (domain)

**DNS Record Format:** The function looks for TXT records at `email._web-identity.$EMAIL_DOMAIN` with format `iss=issuer.example`

**Example:**

```typescript
// Discover issuer from email address
const issuer = await discoverIssuer('user@example.com')
console.log(issuer) // 'issuer.example'

// Or from domain directly
const issuer = await discoverIssuer('example.com')
```

**DNS Setup Example:**

```
email._web-identity.example.com   TXT   iss=issuer.example
```

#### `fetchWebIdentityMetadata(issuerIdentifier, options?)`

Fetches web-identity metadata from an issuer domain's well-known endpoint.

**Parameters:**

- `issuerIdentifier: string` - Issuer domain (e.g., `issuer.example`)
- `options?: RequestOptions` - Optional request configuration
    - `timeout?: number` - Request timeout in milliseconds (default: 10000)
    - `cacheTimeout?: number` - Cache timeout in milliseconds (default: 300000)

**Returns:** `Promise<WebIdentityMetadata>` - Metadata containing endpoints and supported algorithms

**Example:**

```typescript
const metadata = await fetchWebIdentityMetadata('issuer.example', {
    timeout: 5000, // 5 second timeout
    cacheTimeout: 60000, // 1 minute cache
})

console.log(metadata.issuance_endpoint) // 'https://accounts.issuer.example/web-identity/issuance'
console.log(metadata.jwks_uri) // 'https://accounts.issuer.example/web-identity/jwks.json'
console.log(metadata.signing_alg_values_supported) // ['EdDSA', 'RS256']
```

#### `fetchJWKS(jwksUri, options?)`

Fetches JWKS (JSON Web Key Set) from a JWKS URI.

**Parameters:**

- `jwksUri: string` - JWKS URI from web-identity metadata
- `options?: RequestOptions` - Optional request configuration
    - `timeout?: number` - Request timeout in milliseconds (default: 10000)
    - `cacheTimeout?: number` - Cache timeout in milliseconds (default: 300000)

**Returns:** `Promise<JWKSResponse>` - JWKS containing public keys

**Example:**

```typescript
const jwks = await fetchJWKS(metadata.jwks_uri, {
    timeout: 5000,
    cacheTimeout: 300000, // 5 minute cache
})

console.log(jwks.keys.length) // Number of keys available
```

#### `clearCaches()`

Clears the in-memory caches for metadata and JWKS. Useful for testing or forcing fresh fetches.

**Example:**

```typescript
// Clear all caches to force fresh fetches
clearCaches()
```

#### Complete DNS Discovery Example

```typescript
import {
    discoverIssuer,
    fetchWebIdentityMetadata,
    fetchJWKS,
    verifyIssuanceToken,
} from '@hellocoop/web-identity'

// 1. Discover issuer from email domain
const issuer = await discoverIssuer('user@example.com')

// 2. Fetch issuer metadata
const metadata = await fetchWebIdentityMetadata(issuer)

// 3. Fetch issuer's public keys
const jwks = await fetchJWKS(metadata.jwks_uri)

// 4. Create key resolver using fetched JWKS
const keyResolver = async (kid?: string, issuer?: string) => {
    const key = jwks.keys.find((k) => k.kid === kid)
    if (!key) {
        throw new Error(`Key with ID '${kid}' not found`)
    }
    return key
}

// 5. Use with token verification
const verified = await verifyIssuanceToken(issuanceToken, keyResolver)
```

## Types

### KeyResolver

```typescript
type KeyResolver = (kid?: string, issuer?: string) => Promise<JWK | KeyLike>
```

Function to resolve public keys for verification. Called with the key ID (`kid`) from the JWT header and optionally the issuer identifier.

### Token Payloads

```typescript
interface RequestTokenPayload {
    aud: string
    iat?: number
    nonce: string
    email: string
}

interface IssuanceTokenPayload {
    iss: string
    iat?: number
    cnf: { jwk: JWK }
    email: string
    email_verified: boolean
}

interface PresentationTokenPayload {
    sdJwt: IssuanceTokenPayload
    kbJwt: {
        aud: string
        nonce: string
        iat?: number
        sd_hash?: string
    }
}
```

### Generation Options

```typescript
interface TokenGenerationOptions {
    algorithm?: string // Override algorithm from JWK
    expiresIn?: number // Token expiration (default: 60 seconds)
}
```

### DNS Discovery Types

```typescript
interface WebIdentityMetadata {
    issuance_endpoint: string
    jwks_uri: string
    signing_alg_values_supported?: string[]
}

interface JWKSResponse {
    keys: JWK[]
}

interface RequestOptions {
    timeout?: number // Request timeout in milliseconds (default: 10000)
    cacheTimeout?: number // Cache timeout in milliseconds (default: 300000)
}
```

## Error Handling

The package provides specific error classes for different failure scenarios:

```typescript
import {
    WebIdentityError, // Base error class
    MissingClaimError, // Required claim missing
    InvalidSignatureError, // Signature verification failed
    TimeValidationError, // Time-based validation failed
    TokenFormatError, // Invalid token format
    JWKValidationError, // JWK validation failed
    EmailValidationError, // Email validation failed
    DNSDiscoveryError, // DNS discovery failed
    JWKSFetchError, // JWKS/metadata fetch failed
} from '@hellocoop/web-identity'

try {
    const issuer = await discoverIssuer('user@example.com')
    const metadata = await fetchWebIdentityMetadata(issuer)
    const token = await generateRequestToken(payload, key)
} catch (error) {
    if (error instanceof DNSDiscoveryError) {
        console.log(`DNS discovery failed: ${error.message}`)
    } else if (error instanceof JWKSFetchError) {
        console.log(`JWKS fetch failed: ${error.message}`)
    } else if (error instanceof MissingClaimError) {
        console.log(`Missing claim: ${error.message}`)
    } else if (error instanceof EmailValidationError) {
        console.log(`Invalid email: ${error.message}`)
    }
}
```

## Utility Functions

The package also exports utility functions that may be useful:

```typescript
import {
    // Cryptographic utilities
    validateJWK, // Validate JWK structure
    extractPublicKeyParameters, // Extract public key from JWK
    calculateSHA256Hash, // Calculate SHA-256 hash
    isValidEmail, // Validate email format

    // Time utilities
    getCurrentTimestamp, // Get current Unix timestamp
    validateIatClaim, // Validate iat claim
    TIME_VALIDATION_WINDOW, // Default time window (60 seconds)

    // DNS discovery utilities
    discoverIssuer, // Discover issuer from email/domain
    fetchWebIdentityMetadata, // Fetch issuer metadata
    fetchJWKS, // Fetch JWKS from URI
    clearCaches, // Clear in-memory caches
} from '@hellocoop/web-identity'
```

## Module Compatibility

This package supports both **ESM (ECMAScript Modules)** and **CommonJS** environments:

- ✅ **ESM**: `import` statements (Node.js with `"type": "module"`, modern bundlers)
- ✅ **CommonJS**: `require()` statements (traditional Node.js projects)
- ✅ **TypeScript**: Full type definitions included for both module systems
- ✅ **Bundlers**: Works with Webpack, Rollup, Vite, and other modern bundlers

The package automatically provides the correct module format based on your project configuration.

## Algorithm Support

The package supports the following cryptographic algorithms:

- **RSA**: RS256, RS384, RS512
- **EdDSA**: Ed25519 (recommended for new implementations)
- **ECDSA**: ES256, ES384, ES512

## Security Features

- ✅ **Automatic private key stripping** - Private key material is automatically removed from `cnf` claims
- ✅ **Time-based validation** - All tokens validated within 60-second windows
- ✅ **Email format validation** - Comprehensive email validation with security checks
- ✅ **JWK validation** - Thorough validation of key parameters
- ✅ **Cross-algorithm support** - Mix and match RSA and EdDSA keys
- ✅ **Independent verification** - Separate test suite validates token generation

## Security Considerations

- Libraries do not confirm issuer domain is eTLD+1. Browsers will enforce in actual deployments.

## Performance

Typical performance benchmarks on modern hardware:

- RequestToken generation: ~1.3ms average
- RequestToken verification: ~0.15ms average
- EdDSA operations: ~0.3ms round-trip
- Memory usage: <7MB for 1000 operations

## Complete Example

### ESM (ECMAScript Modules)

```typescript
import {
    generateRequestToken,
    verifyRequestToken,
    generateIssuanceToken,
    verifyIssuanceToken,
    generatePresentationToken,
    verifyPresentationToken,
    type KeyResolver,
} from '@hellocoop/web-identity'

// 1. Browser generates RequestToken
const requestToken = await generateRequestToken(
    {
        aud: 'issuer.example',
        nonce: 'rp-nonce-123',
        email: 'user@example.com',
    },
    browserPrivateKey,
)

// 2. Issuer verifies RequestToken
const requestPayload = await verifyRequestToken(requestToken)

// 3. Issuer generates IssuanceToken
const issuanceToken = await generateIssuanceToken(
    {
        iss: 'issuer.example',
        cnf: { jwk: extractedBrowserPublicKey },
        email: requestPayload.email,
        email_verified: true,
    },
    issuerPrivateKey,
)

// 4. Browser verifies IssuanceToken
const keyResolver: KeyResolver = async (kid, issuer) => {
    return await getIssuerPublicKey(kid, issuer)
}

const issuancePayload = await verifyIssuanceToken(issuanceToken, keyResolver)

// 5. Browser generates PresentationToken
const presentationToken = await generatePresentationToken(
    issuanceToken,
    'https://rp.example',
    'rp-nonce-123',
    browserPrivateKey,
)

// 6. Relying Party verifies PresentationToken (automatic DNS discovery)
const presentationPayload = await verifyPresentationToken(
    presentationToken,
    'https://rp.example',
    'rp-nonce-123',
)

console.log('Verified email:', presentationPayload.sdJwt.email)
```

### CommonJS

```javascript
const {
    generateRequestToken,
    verifyRequestToken,
    generateIssuanceToken,
    verifyIssuanceToken,
    generatePresentationToken,
    verifyPresentationToken,
} = require('@hellocoop/web-identity')

// Key resolver function
const keyResolver = async (kid, issuer) => {
    return await getIssuerPublicKey(kid, issuer)
}

// Same usage as ESM example above...
// (The rest of the implementation is identical)
```

## Specification

This package implements the [Verified Email Autocomplete](https://github.com/dickhardt/verified-email-autocomplete) protocol. For detailed protocol information, please refer to the specification.

## Contributing

This package is part of the Hello Identity Co-op packages monorepo. Issues and contributions are welcome.

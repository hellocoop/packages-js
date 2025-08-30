# Design Document

## Overview

The `web-identity` package provides TypeScript functions for generating and verifying JWT tokens used in the Verified Email Autocomplete protocol. The package implements three core token types: RequestToken (JWT), IssuanceToken (SD-JWT), and PresentationToken (SD-JWT+KB). The design emphasizes security, performance, and ease of integration while maintaining compatibility with the web-identity specification.

## JWT Library Selection

After evaluating available Node.js JWT libraries, we will use **`jose`** as the primary JWT processing library for the following reasons:

### Evaluated Libraries

1. **jose** (Recommended Choice)

    - **Pros**: Modern, actively maintained, excellent TypeScript support, comprehensive JWT/JWE/JWS/JWK support, follows latest standards, good performance, minimal dependencies
    - **Cons**: Newer library (less historical usage), API differs from jsonwebtoken
    - **Use Case**: Perfect for modern applications requiring full JWT ecosystem support

2. **jsonwebtoken**

    - **Pros**: Most popular JWT library, extensive community, battle-tested, simple API, good JWK support with companion libraries
    - **Cons**: Primarily synchronous API, requires additional libraries for full JOSE support, larger ecosystem footprint
    - **Use Case**: Applications preferring the most established JWT library

3. **node-jose**

    - **Pros**: Full JOSE implementation, good JWK support
    - **Cons**: Less maintained, complex API, performance issues
    - **Use Case**: Applications requiring full JOSE suite

4. **fast-jwt**
    - **Pros**: High performance, simple API
    - **Cons**: Limited features, no JWK support, minimal ecosystem
    - **Use Case**: High-performance applications with simple JWT needs

### Selection Rationale

We choose **`jose`** because:

- Comprehensive JWK support built-in (required for embedded public keys in RequestTokens)
- Native TypeScript support with comprehensive type definitions
- Modern async/await API design
- Active maintenance and security updates
- Full JOSE ecosystem in a single package
- Support for EdDSA and other modern algorithms
- Minimal dependencies and focused scope
- Better performance for modern cryptographic operations

Note: `jsonwebtoken` would also be a viable choice with good JWK support, but `jose` provides a more modern API and comprehensive JOSE implementation in a single package.

## Architecture

### Package Structure

```
web-identity/
├── src/
│   ├── index.ts                 # Main exports
│   ├── types.ts                 # TypeScript interfaces and types
│   ├── errors.ts                # Custom error classes
│   ├── utils/
│   │   ├── crypto.ts            # Cryptographic utilities
│   │   ├── validation.ts        # Input validation helpers
│   │   ├── time.ts              # Time validation utilities
│   │   └── dns-discovery.ts     # DNS-based issuer discovery and metadata fetching
│   ├── tokens/
│   │   ├── request-token.ts     # RequestToken generation and verification
│   │   ├── issuance-token.ts      # IssuanceToken (SD-JWT) generation and verification
│   │   └── presentation-token.ts # PresentationToken (SD-JWT+KB) generation and verification
│   └── __tests__/
│       ├── independent-verify.ts # Independent verification test suite
│       ├── request-token.test.ts
│       ├── issuance-token.test.ts
│       ├── presentation-token.test.ts
│       ├── dns-discovery.test.ts # DNS discovery function tests
│       └── test-keys/
│           ├── public_jwks.json  # Public keys for testing (RSA + EdDSA)
│           └── private_jwks.json # Private keys for testing (RSA + EdDSA)
├── dist/                        # Compiled output
│   ├── cjs/                     # CommonJS build
│   ├── esm/                     # ESM build
│   └── types/                   # TypeScript declarations
├── package.json
├── tsconfig.json
└── README.md
```

**Note**: Remember to add `"web-identity"` to the workspaces array in the root `package.json` file.

## Components and Interfaces

### Core Types

```typescript
// Key resolver callback for verification functions
export type KeyResolver = (
    kid?: string,
    issuer?: string,
) => Promise<JWK | KeyLike | Uint8Array>

// Token payloads
export interface RequestTokenPayload {
    iss: string
    aud: string
    iat?: number // Optional for testing expired tokens
    nonce: string
    email: string
}

export interface IssuanceTokenPayload {
    iss: string
    iat?: number // Optional for testing expired tokens
    cnf: {
        jwk: JWK // Only essential JWK parameters included
    }
    email: string
    email_verified: boolean
}

export interface PresentationTokenPayload {
    sdJwt: IssuanceTokenPayload
    kbJwt: {
        aud: string
        nonce: string
        iat?: number // Optional for testing expired tokens
        sd_hash?: string // Calculated automatically if not provided
    }
}

// Generation options
export interface TokenGenerationOptions {
    algorithm?: string // Default: 'EdDSA'
    expiresIn?: number // Default: 60 seconds
}

// DNS Discovery types
export interface WebIdentityMetadata {
    issuance_endpoint: string
    jwks_uri: string
    signing_alg_values_supported?: string[]
}

export interface JWKSResponse {
    keys: JWK[]
}

export interface RequestOptions {
    timeout?: number // Request timeout in milliseconds (default: 10000)
    cacheTimeout?: number // Cache timeout in milliseconds (default: 300000)
}
```

### Core Functions

#### RequestToken Functions

```typescript
export async function generateRequestToken(
    payload: RequestTokenPayload,
    jwk: JWK, // JWK containing private key, alg, and kid
    options?: TokenGenerationOptions,
): Promise<string>

export async function verifyRequestToken(
    token: string,
    keyResolver: KeyResolver,
): Promise<RequestTokenPayload>
```

#### IssuanceToken Functions

```typescript
export async function generateIssuanceToken(
    payload: IssuanceTokenPayload,
    jwk: JWK, // JWK containing private key, alg, and kid
    options?: TokenGenerationOptions,
): Promise<string>

export async function verifyIssuanceToken(
    token: string,
    keyResolver: KeyResolver,
): Promise<IssuanceTokenPayload>
```

#### PresentationToken Functions

```typescript
export async function generatePresentationToken(
    sdJwt: string,
    audience: string,
    nonce: string,
    jwk: JWK, // JWK containing private key, alg, and kid
    options?: TokenGenerationOptions,
): Promise<string>

export async function verifyPresentationToken(
    token: string,
    keyResolver: KeyResolver,
    expectedAudience: string,
    expectedNonce: string,
): Promise<PresentationTokenPayload>
```

#### DNS Discovery Functions

```typescript
export async function discoverIssuer(emailOrDomain: string): Promise<string>

export async function fetchWebIdentityMetadata(
    issuerIdentifier: string,
    options?: RequestOptions,
): Promise<WebIdentityMetadata>

export async function fetchJWKS(
    jwksUri: string,
    options?: RequestOptions,
): Promise<JWKSResponse>

export function clearCaches(): void
```

## Data Models

### Token Structure

#### RequestToken (JWT)

- **Header**: `alg`, `typ`, `jwk` (embedded public key)
- **Payload**: `iss`, `aud`, `iat`, `nonce`, `email`
- **Signature**: Signed with browser's private key

#### IssuanceToken (SD-JWT)

- **Header**: `alg`, `typ` ("web-identity+sd-jwt"), `kid`
- **Payload**: `iss`, `iat`, `cnf` (confirmation with public key), `email`, `email_verified`
- **Signature**: Signed with issuer's private key

#### PresentationToken (SD-JWT+KB)

- **Format**: `{SD-JWT}~{KB-JWT}`
- **SD-JWT**: Same as IssuanceToken
- **KB-JWT**:
    - **Header**: `alg`, `typ` ("kb+jwt")
    - **Payload**: `aud`, `nonce`, `iat`, `sd_hash`
    - **Signature**: Signed with browser's private key

### Validation Rules

#### Time Validation

- `iat` claims must be within 60 seconds of current time for all token types
- Consistent 60-second validation window across RequestToken, IssuanceToken, and PresentationToken verification

#### Claim Validation

- All required claims must be present (throws `missing_claim` error if absent)
- Email addresses must be syntactically valid
- `email_verified` must be `true` in IssuanceTokens
- `sd_hash` is calculated automatically from SD-JWT in PresentationTokens
- JWK validation: must contain required `alg`, `kid`, and algorithm-specific parameters
- JWK in `cnf` claim contains only essential public key parameters (no private key material)

## Error Handling

### Custom Error Classes

```typescript
export class WebIdentityError extends Error {
    constructor(
        message: string,
        public code: string,
    ) {
        super(message)
        this.name = 'WebIdentityError'
    }
}

export class MissingClaimError extends WebIdentityError {
    constructor(claim: string) {
        super(`Required claim '${claim}' is missing`, 'missing_claim')
    }
}

export class InvalidSignatureError extends WebIdentityError {
    constructor() {
        super('Token signature verification failed', 'invalid_signature')
    }
}

export class TimeValidationError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'time_validation')
    }
}

export class TokenFormatError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'token_format')
    }
}

export class DNSDiscoveryError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'dns_discovery')
    }
}

export class JWKSFetchError extends WebIdentityError {
    constructor(message: string) {
        super(message, 'jwks_fetch')
    }
}
```

### Error Handling Strategy

1. **Input Validation**: Validate all inputs before processing
2. **Graceful Failures**: Provide descriptive error messages
3. **Security**: Avoid leaking sensitive information in error messages
4. **Consistency**: Use consistent error types across all functions

## Testing Strategy

### Unit Tests

- Test each function with valid inputs
- Test error conditions and edge cases
- Test time validation boundaries
- Test malformed token handling

### Independent Verification Suite

- Separate test module that uses different JWT parsing logic
- Verifies tokens generated by main functions
- Ensures compatibility and correctness
- Uses Node.js built-in crypto module for signature verification

### Integration Tests

- End-to-end token flow testing
- Cross-validation between generate and verify functions
- Performance benchmarking

### Test Data

- Valid test vectors for each token type
- Invalid token examples for error testing
- Edge cases (expired tokens, malformed claims, etc.)

### Test Key Management

- **public_jwks.json**: Contains public keys for both RSA and EdDSA algorithms with unique key IDs
- **private_jwks.json**: Contains corresponding private keys for testing token generation
- **Cross-algorithm testing**: Tests will alternate between browser using RSA/issuer using EdDSA and vice versa
- **Key rotation testing**: Verify handling of multiple keys with different IDs

#### Test Key Structure

```json
{
    "keys": [
        {
            "kid": "rsa-test-key-1",
            "kty": "RSA",
            "alg": "RS256"
            // RSA key parameters
        },
        {
            "kid": "eddsa-test-key-1",
            "kty": "OKP",
            "crv": "Ed25519",
            "alg": "EdDSA"
            // EdDSA key parameters
        }
    ]
}
```

## DNS Discovery Architecture

### DNS-based Issuer Discovery

The DNS discovery system implements the Verified Email Autocomplete specification for finding issuers through DNS TXT records.

#### DNS Record Format

- **Lookup Domain**: `email._web-identity.$EMAIL_DOMAIN`
- **Record Format**: `iss=issuer.example`
- **Validation**: Only one `iss=` record allowed per domain (spec clarification needed)

#### Domain Validation

- Comprehensive domain format validation with regex patterns
- Length constraints: domain max 253 chars, labels max 63 chars
- Minimum eTLD+1 format requirement (at least one dot)
- Case normalization to lowercase for consistency

#### Metadata Discovery

- **Endpoint**: `https://issuer.example/.well-known/web-identity`
- **Redirect Support**: Follows redirects to subdomains of same issuer domain
- **Validation**: Ensures all URLs in metadata end with issuer domain
- **Required Fields**: `issuance_endpoint`, `jwks_uri`
- **Optional Fields**: `signing_alg_values_supported`

#### JWKS Fetching

- Fetches from `jwks_uri` provided in metadata
- Validates JWKS structure and required key fields (`kty`, `kid`)
- Supports standard JWKS format with multiple keys

#### Caching Strategy

- **In-memory caching** for both metadata and JWKS
- **Configurable timeouts**: Default 5 minutes, customizable per request
- **Cache keys**: Normalized issuer identifiers and JWKS URIs
- **Cache management**: `clearCaches()` function for testing and cleanup

#### Network Configuration

- **Timeout Support**: Configurable request timeouts (default: 10 seconds)
- **Redirect Following**: Automatic redirect handling with domain validation
- **Error Handling**: Specific error types for DNS vs HTTP failures
- **AbortController**: Proper request cancellation on timeout

## Security Considerations

### Key Management

- Support for multiple key types (RSA, ECDSA, EdDSA)
- JWK validation: verify presence of `alg`, `kid`, and algorithm-specific parameters
- Extract algorithm and key ID from JWK for header population
- Strip private key material when including JWK in `cnf` claims
- Secure key resolution through callback pattern

### Algorithm Support

- Default to EdDSA for new implementations
- Support RSA and ECDSA for compatibility
- Reject weak algorithms (HS256 with short keys)

### Time-based Security

- Strict time validation to prevent replay attacks
- Configurable time windows for different use cases
- Clock skew tolerance

### Input Validation

- Comprehensive validation of all inputs
- Protection against injection attacks
- Proper handling of malformed data

### DNS Discovery Security

- **Domain Validation**: Strict validation of email domains and issuer identifiers
- **Redirect Validation**: Ensures redirects only go to subdomains of the same issuer
- **URL Validation**: All metadata URLs must end with the issuer domain
- **DNS Security**: Protection against DNS spoofing through domain validation
- **Request Timeouts**: Prevents hanging requests and DoS attacks
- **Cache Security**: In-memory caching prevents external cache poisoning

## Performance Considerations

### Optimization Strategies

- Lazy loading of cryptographic operations
- Efficient key caching in KeyResolver implementations
- Minimal object creation in hot paths
- Async operations to prevent blocking

### Memory Management

- Proper cleanup of sensitive data
- Efficient string operations for large tokens
- Minimal dependency footprint

## Dependencies

### Production Dependencies

- `jose`: ^5.0.0 (JWT/JWS/JWK operations)

### Development Dependencies

- `typescript`: ^5.0.0
- `@types/node`: ^20.0.0
- `vitest`: ^1.0.0 (testing framework)
- `@tsconfig/node20`: ^20.1.2

## Package Configuration

### TypeScript Configuration

- Target: ES2022
- Module: ESNext with CommonJS compatibility
- Strict type checking enabled
- Declaration files generated
- Node.js 20+ target for modern features and performance

**Note**: Using `@tsconfig/node20` instead of node18 to align with modern Node.js LTS and take advantage of performance improvements and newer JavaScript features available in Node.js 20+.

### Build Output

- ESM and CommonJS builds
- TypeScript declaration files
- Source maps for debugging

### Package Exports

```json
{
    "main": "./dist/cjs/index.js",
    "module": "./dist/esm/index.js",
    "types": "./dist/types/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/esm/index.js",
            "require": "./dist/cjs/index.js",
            "types": "./dist/types/index.d.ts"
        }
    }
}
```

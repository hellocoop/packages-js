# @hellocoop/httpsig

HTTP Message Signatures (RFC 9421) implementation with Signature-Key header support for Node.js and browsers.

## Overview

This package implements [RFC 9421 HTTP Message Signatures](https://datatracker.ietf.org/doc/html/rfc9421) with support for the [Signature-Key header proposal](https://github.com/DickHardt/signature-key), enabling cryptographic signing and verification of HTTP requests.

**Key Features:**

- Zero dependencies
- TypeScript support with full type definitions
- Works in Node.js and modern browsers
- Three key distribution schemes: `hwk`, `jwt`, and `jwks`
- Simple API: `fetch()` wrapper and `verify()` middleware helper
- Automatic signature generation and header management
- Built-in JWKS caching for performance

## Installation

```bash
npm install @hellocoop/httpsig
```

## Quick Start

### Signing Requests

```typescript
import { fetch } from '@hellocoop/httpsig'

// Make a signed GET request with inline public key (hwk)
const response = await fetch('https://api.example.com/data', {
    signingKey: privateKeyJwk, // JsonWebKey with private key
    signatureKey: { type: 'hwk' },
})

// Make a signed POST request
const response = await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foo: 'bar' }),
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
})
```

### Verifying Requests

```typescript
import { verify } from '@hellocoop/httpsig'

// In Express middleware
app.use(async (req, res, next) => {
    try {
        // Parse URL to extract path and query
        const urlObj = new URL(
            req.originalUrl,
            `${req.protocol}://${req.hostname}`,
        )

        const result = await verify({
            method: req.method,
            authority: req.hostname,
            path: urlObj.pathname,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers: req.headers,
            body: req.body,
        })

        if (result.verified) {
            req.signature = result
            next()
        } else {
            res.status(401).json({ error: 'Invalid signature' })
        }
    } catch (error) {
        res.status(401).json({ error: error.message })
    }
})
```

## API Reference

### `fetch(url, options)`

A drop-in replacement for the standard `fetch()` that automatically signs requests.

**Parameters:**

- `url` (string | URL): The URL to fetch
- `options` (HttpSigFetchOptions): Standard fetch options plus signing parameters

**HttpSigFetchOptions extends RequestInit:**

```typescript
interface HttpSigFetchOptions extends RequestInit {
    // Required: Private key as JWK
    signingKey: JsonWebKey

    // Required: Signature-Key header configuration
    signatureKey:
        | { type: 'hwk' }
        | { type: 'jwt'; jwt: string }
        | { type: 'jwks'; id: string; kid: string; wellKnown?: string }

    // Optional parameters
    label?: string // Signature label (default: 'sig')
    components?: string[] // Override default components

    // Testing mode
    dryRun?: boolean // Return headers without fetching (still returns Promise)
}
```

**Returns:**

- `Promise<Response>` - Standard fetch Response object
- If `dryRun: true`, returns `Promise<{ headers: Headers }>` with the headers that would be sent

**Example with hwk:**

```typescript
const response = await fetch('https://api.example.com/data', {
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
})
```

**Example with JWT:**

```typescript
const response = await fetch('https://api.example.com/data', {
    signingKey: privateKeyJwk,
    signatureKey: {
        type: 'jwt',
        jwt: 'eyJhbGciOiJFZERTQSIsInR5cCI6ImFnZW50K2p3dCJ9...',
    },
})
```

**Example with JWKS:**

```typescript
const response = await fetch('https://api.example.com/data', {
    signingKey: privateKeyJwk,
    signatureKey: {
        type: 'jwks',
        id: 'https://agent.example',
        kid: 'key-1',
        wellKnown: 'agent-server', // Optional
    },
})
```

**Testing mode (dry run):**

```typescript
const { headers } = await fetch('https://api.example.com/data', {
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
    dryRun: true,
})

console.log(headers.get('Signature'))
console.log(headers.get('Signature-Input'))
console.log(headers.get('Signature-Key'))
```

**Overriding default components:**

```typescript
import {
    fetch,
    DEFAULT_COMPONENTS_GET,
    DEFAULT_COMPONENTS_BODY,
} from '@hellocoop/httpsig'

// Default components for requests without body (GET, DELETE):
// ['@method', '@authority', '@path', 'signature-key']

// Default components for requests with body (POST, PUT, PATCH):
// ['@method', '@authority', '@path', 'content-type', 'content-digest', 'signature-key']

// Override defaults for RFC 9421 interoperability
const response = await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: {
        date: new Date().toUTCString(),
        'content-type': 'application/json',
    },
    body: JSON.stringify({ foo: 'bar' }),
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
    // Override with different components
    components: [
        'date',
        '@method',
        '@path',
        '@authority',
        'content-type',
        'content-digest',
        'signature-key',
    ],
})

// To extend defaults, add new components
const components = [
    ...DEFAULT_COMPONENTS_BODY,
    'date', // Add date header to signature
    'authorization', // Add authorization header
]

// Note: Duplicates are automatically removed
```

### `verify(request, options?)`

Verifies HTTP Message Signatures on incoming requests.

**Parameters:**

- `request` (VerifyRequest): The request to verify
- `options?` (VerifyOptions): Optional verification configuration

**VerifyRequest:**

```typescript
interface VerifyRequest {
    method: string
    authority: string // Canonical authority (e.g., 'api.example.com')
    path: string // Request path (e.g., '/api/data')
    query?: string // Optional query string without leading '?' (e.g., 'foo=bar')
    headers: Headers | Record<string, string | string[]>
    body?: string | Buffer | Uint8Array
}
```

**Note**: The body must be raw bytes (string, Buffer, or Uint8Array), **NOT** a parsed object. If you pass a parsed JSON object, signature verification will fail because the content-digest is computed over the exact bytes.

**VerifyOptions:**

```typescript
interface VerifyOptions {
    // Timestamp validation
    maxClockSkew?: number // Max clock skew in seconds (default: 60)

    // JWKS caching
    jwksCacheTtl?: number // JWKS cache TTL in ms (default: 3600000)

    // AAuth profile enforcement
    strictAAuth?: boolean // Enforce AAuth profile requirements (default: true)
    // When true, requires signature-key in covered components
}
```

**Returns:** `Promise<VerificationResult>`

```typescript
interface VerificationResult {
    verified: boolean // Overall verification status
    label: string // Signature label used
    keyType: 'hwk' | 'jwt' | 'jwks'
    publicKey: JsonWebKey // Extracted public key
    thumbprint: string // JWK thumbprint (RFC 7638) - stable key identifier
    created: number // Signature timestamp

    // JWT-specific fields (if keyType === 'jwt')
    // Note: JWT is NOT validated - caller must validate issuer, expiration, etc.
    jwt?: {
        header: object
        payload: object
        raw: string // Raw JWT for caller to validate
    }

    // JWKS-specific fields (if keyType === 'jwks')
    jwks?: {
        id: string
        kid: string
        wellKnown?: string
    }

    // Error information
    error?: string
}
```

**Example with Express:**

```typescript
import express from 'express'
import { expressVerify } from '@hellocoop/httpsig'

const app = express()

// IMPORTANT: Use express.raw() NOT express.json()!
app.use(express.raw({ type: 'application/json' }))

app.use(async (req, res, next) => {
    const result = await expressVerify(req)

    if (result.verified) {
        req.signature = result
        next()
    } else {
        res.status(401).json({ error: result.error })
    }
})
```

**Example with Fastify:**

```typescript
import Fastify from 'fastify'
import { fastifyVerify } from '@hellocoop/httpsig'

const fastify = Fastify({
    // Preserve raw body for signature verification
    preParsing: async (request, reply, payload) => {
        const chunks: Buffer[] = []
        for await (const chunk of payload) {
            chunks.push(chunk)
        }
        request.rawBody = Buffer.concat(chunks)
        return Buffer.concat(chunks)
    },
})

fastify.addHook('preHandler', async (request, reply) => {
    const result = await fastifyVerify(request)

    if (!result.verified) {
        reply.code(401).send({ error: result.error })
        return
    }

    request.signature = result
})
```

**Example with Next.js App Router:**

```typescript
import { nextJsVerify } from '@hellocoop/httpsig'

export async function POST(request: Request) {
    // IMPORTANT: Consume body BEFORE verification!
    const body = await request.text()

    const result = await nextJsVerify(request, body)

    if (!result.verified) {
        return Response.json({ error: result.error }, { status: 401 })
    }

    // Parse body after verification
    const data = JSON.parse(body)

    // ... handle request
}
```

**Example with JWT validation:**

```typescript
const result = await verify(request)

if (result.verified && result.keyType === 'jwt') {
    // Caller is responsible for validating the JWT
    const jwt = result.jwt

    // Decode and validate JWT claims
    const isValid = await validateJWT(jwt.raw, {
        trustedIssuers: ['https://auth.example.com'],
        // ... other validation logic
    })

    if (!isValid) {
        throw new Error('Invalid JWT')
    }
}
```

**Example using thumbprint for authorization:**

```typescript
// Store allowed public key thumbprints (e.g., from registration)
const ALLOWED_THUMBPRINTS = new Set([
    'NZQltk3VvFCjGIx8-UtxKBwkjRZ6O8kPKYNa3mRYFX8',
    'kOzFrbnFA0SWOSKmY76ok0Ke-soe9Ja41xzhlK9v8Yo',
])

app.use(async (req, res, next) => {
    const result = await expressVerify(req)

    if (!result.verified) {
        return res.status(401).json({ error: result.error })
    }

    // Use thumbprint as stable identifier for rate limiting, access control, etc.
    if (!ALLOWED_THUMBPRINTS.has(result.thumbprint)) {
        return res.status(403).json({
            error: 'Public key not authorized',
            thumbprint: result.thumbprint,
        })
    }

    // Store thumbprint for logging/auditing
    req.callerThumbprint = result.thumbprint
    next()
})
```

## Framework Integration Requirements

### Critical Requirements for `verify()`

When verifying HTTP Message Signatures, you **MUST** provide:

1. **Raw Body Bytes** - NOT parsed JSON objects
2. **Full URL** - NOT just the path

#### ❌ Common Mistakes

```typescript
// ❌ WRONG - body is parsed object
app.use(express.json())
app.use((req, res) => {
    verify({
        body: req.body, // This is { foo: "bar" }, not raw bytes!
    })
})

// ❌ WRONG - url is just the path
verify({
    url: req.url, // This is "/api/data", not "https://example.com/api/data"
})
```

#### ✅ Correct Approach

Use the framework-specific verify functions which handle these requirements automatically:

```typescript
import { expressVerify } from '@hellocoop/httpsig'

app.use(express.raw({ type: 'application/json' }))
app.use(async (req, res) => {
    const result = await expressVerify(req)
})
```

### Why These Requirements Matter

**Raw Body**: The `content-digest` is computed over the **exact bytes** of the body. If you parse JSON and re-serialize it:

- Whitespace might differ: `{"foo":"bar"}` vs `{"foo": "bar"}`
- Key order might change
- The digest won't match → verification fails

**Full URL**: The signature covers the complete `@target-uri`, including protocol and hostname. Using just the path will produce a different signature base → verification fails.

### Framework-Specific Verify Functions

The package provides framework-specific functions that handle URL construction and body handling automatically:

- `expressVerify(req, options?)` - Express.js
- `fastifyVerify(request, options?)` - Fastify
- `nextJsVerify(request, body?, options?)` - Next.js App Router
- `nextJsPagesVerify(req, body?, host?, options?)` - Next.js Pages Router

These functions call `verify()` internally after correctly transforming the request.

See examples in the [`verify()` documentation](#verify-request-options) above.

## Signature Components

### Default Components

By default, requests are signed with these components:

**Requests without a body (GET, DELETE):**

- `@method` - HTTP method
- `@target-uri` - Full URL
- `signature-key` - The Signature-Key header

```
Signature-Input: sig=("@method" "@target-uri" "signature-key");created=1730217600
```

**Requests with a body (POST, PUT, PATCH):**

- `@method` - HTTP method
- `@target-uri` - Full URL
- `content-type` - Content-Type header
- `content-digest` - Content-Digest header (auto-generated)
- `signature-key` - The Signature-Key header

```
Signature-Input: sig=("@method" "@target-uri" "content-type" "content-digest" "signature-key");created=1730217600
```

The `content-digest` is computed as:

```
Content-Digest: sha-256=:BASE64(SHA256(body)):
```

### Overriding Default Components

You can override the default components using the `components` parameter. The library exports helpful constants:

**Exported Constants:**

```typescript
import {
    VALID_DERIVED_COMPONENTS, // All valid RFC 9421 derived components
    DEFAULT_COMPONENTS_GET, // Default for GET requests
    DEFAULT_COMPONENTS_BODY, // Default for requests with body
} from '@hellocoop/httpsig'

// VALID_DERIVED_COMPONENTS contains:
// ['@method', '@target-uri', '@authority', '@scheme',
//  '@request-target', '@path', '@query', '@query-param', '@status']

// DEFAULT_COMPONENTS_GET contains:
// ['@method', '@target-uri', 'signature-key']

// DEFAULT_COMPONENTS_BODY contains:
// ['@method', '@target-uri', 'content-type', 'content-digest', 'signature-key']
```

**Example - Override with RFC 9421 compatible components:**

```typescript
// Override defaults to use @path and @authority instead of @target-uri
await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: { date: new Date().toUTCString() },
    body: JSON.stringify({ data: 'value' }),
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
    components: [
        'date', // Include date header
        '@method',
        '@path', // Instead of @target-uri
        '@authority', // Instead of @target-uri
        'content-type',
        'content-digest',
    ],
})
```

**Component Validation:**

- Derived components (starting with `@`) must be in `VALID_DERIVED_COMPONENTS`
- Header components must exist in the request headers
- Duplicate components are automatically removed
- Invalid components throw an error with a clear message

## Signature-Key Types

The Signature-Key header uses [RFC 8941 Structured Fields Dictionary format](https://www.rfc-editor.org/rfc/rfc8941.html) with exactly one dictionary member. The member key (label) is used to correlate the three signature headers: `Signature-Key`, `Signature-Input`, and `Signature`.

**Format:** `label=scheme;param1="value1";param2="value2"`

**Label Discovery:** During verification, the label is automatically discovered from the Signature-Key header (per AAuth spec). The same label must appear in both Signature-Input and Signature headers.

**AAuth Profile Requirement:** When `strictAAuth: true` (default), the `signature-key` component must be included in the covered components list.

### hwk (Header Web Key)

Inline public key in the header for pseudonymous verification.

```typescript
const response = await fetch(url, {
    signingKey: privateKeyJwk,
    signatureKey: { type: 'hwk' },
})
```

Generated headers (RFC 8941 Dictionary format):

```http
Signature-Key: sig=hwk;kty="OKP";crv="Ed25519";x="JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs"
```

**Use cases:**

- Privacy-preserving agents
- Temporary or experimental access
- Rate limiting per key

### jwt (JWT Confirmation Key)

Public key embedded in a signed JWT using the `cnf.jwk` claim.

```typescript
const response = await fetch(url, {
    signingKey: privateKeyJwk,
    signatureKey: {
        type: 'jwt',
        jwt: agentToken, // JWT with cnf.jwk claim
    },
})
```

Generated headers (RFC 8941 Dictionary format):

```http
Signature-Key: sig=jwt;jwt="eyJhbGciOiJFZERTQSIsInR5cCI6ImFnZW50K2p3dCJ9..."
```

The JWT must contain:

```json
{
    "iss": "https://issuer.example",
    "sub": "instance-123",
    "exp": 1732210000,
    "cnf": {
        "jwk": {
            "kty": "OKP",
            "crv": "Ed25519",
            "x": "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs"
        }
    }
}
```

**Use cases:**

- Distributed services with ephemeral keys
- Delegation scenarios
- Short-lived credentials for horizontal scaling

### jwks (JWKS Discovery)

Key discovery via HTTPS URLs with automatic caching.

```typescript
const response = await fetch(url, {
    signingKey: privateKeyJwk,
    signatureKey: {
        type: 'jwks',
        id: 'https://agent.example',
        kid: 'key-1',
    },
})
```

Generated headers (RFC 8941 Dictionary format):

```http
Signature-Key: sig=jwks;id="https://agent.example";kid="key-1"
```

With well-known metadata:

```typescript
const response = await fetch(url, {
    signingKey: privateKeyJwk,
    signatureKey: {
        type: 'jwks',
        id: 'https://agent.example',
        kid: 'key-1',
        wellKnown: 'agent-server',
    },
})
```

Generated headers (RFC 8941 Dictionary format):

```http
Signature-Key: sig=jwks;id="https://agent.example";kid="key-1";well-known="agent-server"
```

**Discovery process:**

1. If `well-known` present: fetch `{id}/.well-known/{well-known}`, extract `jwks_uri`, fetch JWKS
2. If `well-known` absent: fetch `{id}` directly as JWKS
3. Find key with matching `kid`
4. Cache JWKS with configurable TTL (default 1 hour)

**Use cases:**

- Identified services with stable HTTPS identity
- Search engine crawlers
- Services requiring explicit entity identification

## Supported Algorithms

We support the two most widely recommended algorithms from the [IANA HTTP Message Signatures registry](https://www.iana.org/assignments/http-message-signature/http-message-signature.xhtml):

- **Ed25519** (`ed25519`) - EdDSA with Curve25519 - **Recommended**

    - Fast, secure, deterministic
    - Small signatures (64 bytes)
    - Perfect interoperability

- **ES256** (`ecdsa-p256-sha256`) - ECDSA with P-256 and SHA-256
    - Industry standard (JWT, WebAuthn)
    - Widely supported
    - Perfect interoperability

## Security Considerations

### Timestamp Validation

- Signatures must have a `created` timestamp
- Timestamp must be within ±60 seconds (configurable via `maxClockSkew`)
- Prevents replay attacks

### JWT Handling

When verifying `jwt` signature-key types:

- The JWT is decoded and the `cnf.jwk` claim is extracted
- The extracted public key is used to verify the HTTP signature
- **JWT validation is NOT performed** - the raw JWT is returned to the caller
- Caller is responsible for validating JWT signature, issuer, expiration, etc.

### JWKS Caching

- JWKS responses are cached to prevent excessive fetches
- Default TTL: 1 hour (configurable)
- Cache respects HTTP `Cache-Control` headers
- Cache keyed by JWKS URL

### Key Validation

- All cryptographic material is validated before use
- JWK structure and parameters are verified
- Algorithm/key type mismatches are rejected

## Testing

The package includes a comprehensive test suite:

```bash
npm test
```

To run tests with coverage:

```bash
npm run test:coverage
```

## Examples

See the `examples/` directory for complete examples:

- `examples/basic-fetch.ts` - Simple GET and POST requests
- `examples/express-middleware.ts` - Express integration
- `examples/fastify-middleware.ts` - Fastify integration
- `examples/all-key-types.ts` - Using hwk, jwt, and jwks

## Standards Compliance

This implementation follows:

- [RFC 9421: HTTP Message Signatures](https://datatracker.ietf.org/doc/html/rfc9421)
- [RFC 9530: Digest Fields](https://datatracker.ietf.org/doc/html/rfc9530)
- [RFC 7515: JSON Web Signature (JWS)](https://datatracker.ietf.org/doc/html/rfc7515)
- [RFC 7517: JSON Web Key (JWK)](https://datatracker.ietf.org/doc/html/rfc7517)
- [RFC 7800: Proof-of-Possession Key Semantics for JWTs](https://datatracker.ietf.org/doc/html/rfc7800)
- [Signature-Key Header Proposal](https://github.com/DickHardt/signature-key)

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

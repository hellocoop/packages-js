# Testing Notes and Findings

## Edge Cases Tested

### 1. Content-Type Handling

**Question**: How does fetch determine content-type for the body?

**Finding**: Our implementation now **matches standard `fetch()` behavior** for automatic content-type detection:

- Standard `fetch()` behavior (now matched by our implementation):
    - String body (including empty string) → `text/plain;charset=UTF-8`
    - URLSearchParams → `application/x-www-form-urlencoded;charset=UTF-8`
    - FormData → `multipart/form-data` with boundary (handled by fetch)
    - Blob/File → uses blob's type, or `application/octet-stream` if no type
    - Binary data (ArrayBuffer, etc.) → `application/octet-stream`
    - null/undefined → no content-type header

**Implementation**: Uses `getContentTypeFromBody()` helper function that inspects the body type and returns the appropriate content-type, matching standard fetch semantics.

**Recommendation**: For JSON requests, users should still explicitly set:

```typescript
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ foo: 'bar' })
```

This is because `JSON.stringify()` returns a string, which defaults to `text/plain;charset=UTF-8`.

### 2. JavaScript Object as Body

**Question**: What happens if a plain JS object is passed as the body?

**Finding**: Like standard `fetch()`, plain JavaScript objects are **not supported**. They must be serialized first.

**Correct usage**:

```typescript
body: JSON.stringify({ foo: 'bar' }) // ✓ Correct
```

**Incorrect usage**:

```typescript
body: {
    foo: 'bar'
} // ✗ Will fail - not supported by fetch()
```

This matches standard `fetch()` behavior - the body parameter must be a string, Buffer, Blob, FormData, URLSearchParams, or ReadableStream.

### 3. Invalid Signing Key

**Question**: What happens if an invalid signing key is passed?

**Finding**: Our implementation validates JWKs before attempting to use them:

- Missing `kty` → Error: `JWK missing required field: kty`
- Unsupported `kty` → Error: `Unsupported key type: UNKNOWN`
- OKP missing `x` → Error: `OKP JWK missing required field: x`
- EC missing `y` → Error: `EC JWK missing required field: y`
- RSA key → Error: `Unsupported key type: RSA`

Validation happens **synchronously** before any async operations, providing fast failure feedback.

### 4. Body Handling Edge Cases

**Tested scenarios**:

- `body: undefined` → No content headers added ✓
- `body: null` → No content headers added ✓
- `body: ''` (empty string) → Content headers ARE added ✓

Empty string is considered a valid body (0 bytes) and gets signed.

### 5. Signature Verification Tampering

**Tested scenarios**:

- Tampered Signature-Input → ✗ Verification fails
- Wrong URL → ✗ Verification fails
- Wrong HTTP method → ✗ Verification fails
- Modified body → ✗ Verification fails (content-digest mismatch)
- Expired timestamp → ✗ Verification fails

All tampering attempts are correctly rejected.

## Existing RFC 9421 Implementations

We surveyed existing npm packages implementing HTTP Message Signatures:

### Packages Found:

1. **@misskey-dev/node-http-message-signatures** - Implements RFC 9421

    - Used in ActivityPub (Misskey, Mastodon)
    - Uses **PEM format** for keys (not JWK)
    - Supports RSA-SHA256 and Ed25519

2. **http-message-sig** - Implements RFC 9421

    - Forked from ltonetwork/http-message-signatures

3. **eBay digital-signature-nodejs-sdk** - Implements RFC 9421

    - NodeJS SDK for eBay's digital signature requirements

4. **http-signature** (Joyent) - Implements **OLD draft**, NOT RFC 9421

    - Most popular but outdated
    - Uses draft-cavage-http-signatures (deprecated)

5. **@digitalbazaar/http-signature-header** - Implements draft-12, NOT RFC 9421
    - Being updated to RFC 9421 (in progress)

### Interoperability Challenges:

Creating interoperability tests proved challenging because:

1. Most packages use **PEM keys**, we use **JWK**
2. Different packages implement different features:
    - We implement the **Signature-Key header** proposal
    - Others use Authorization headers or different schemes
3. Key format conversion (JWK ↔ PEM) would add dependencies

### Our Approach:

Instead of adding dependencies for interop testing, we:

1. Thoroughly tested RFC 9421 compliance internally
2. Tested all edge cases
3. Tested signature tampering detection
4. Verified content-digest validation
5. Tested all three key types (hwk, jwt, jwks)
6. **Created format conversion tests** using `crypto.subtle`:
    - Generate key pairs and export in both JWK and PEM (SPKI/PKCS8) formats
    - Verify cross-format compatibility (sign with one format, verify with another)
    - Demonstrate that keys can be converted between formats for interop
    - See `tests/test-interop.ts` for conversion examples

**Key Format Interoperability**:

- We use JWK format (JSON Web Key)
- Other implementations typically use PEM format (SPKI for public, PKCS8 for private)
- `crypto.subtle` can import/export keys in both formats
- This enables interoperability: generate keys once, export for different implementations
- Example: Export JWK public key as SPKI PEM for use with @misskey-dev/node-http-message-signatures

## Test Coverage

**Total tests: 46**

- Framework compatibility: 2 tests
- hwk (Header Web Key): 4 tests
- jwt (JWT with cnf.jwk): 4 tests
- jwks (JWKS discovery): 5 tests
- Edge cases: 17 tests (including new content-type tests for URLSearchParams, Blob, etc.)
- Standard fetch behavior: 8 tests (documenting standard fetch content-type behavior)
- Error propagation: 2 tests (explicit validateJwk error propagation tests)
- Interoperability: 4 tests (JWK ↔ PEM format conversion)

**All tests passing** ✓

## Recommendations

1. **Always explicitly set Content-Type for JSON**:

    ```typescript
    body: JSON.stringify(data)
    headers: { 'Content-Type': 'application/json' }
    ```

    Without explicit headers, string bodies (including JSON.stringify results) default to `text/plain;charset=UTF-8`.

2. **Content-Type now matches standard fetch**:

    - String bodies → `text/plain;charset=UTF-8`
    - URLSearchParams → `application/x-www-form-urlencoded;charset=UTF-8`
    - Blob → uses blob.type or `application/octet-stream`
    - Binary data → `application/octet-stream`

3. **JWK validation** happens early - invalid keys fail fast

4. **Content-digest** is validated against actual body bytes

5. **Signature tampering** is reliably detected

6. **Key format interoperability**: Use `crypto.subtle` to convert between JWK and PEM formats when needed for interop with other implementations

## Standards Compliance

Our implementation follows:

- ✓ RFC 9421: HTTP Message Signatures
- ✓ RFC 9530: Digest Fields (content-digest)
- ✓ RFC 7517: JSON Web Key (JWK)
- ✓ RFC 7800: Proof-of-Possession (JWT cnf.jwk claim)
- ✓ RFC 7638: JWK Thumbprint
- ✓ Signature-Key Header Proposal

No deviations from standards detected in testing.

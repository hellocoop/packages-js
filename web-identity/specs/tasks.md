# Implementation Plan

- [x]   1. Set up project structure and package configuration

    - Create web-identity directory with src, dist structure
    - Initialize package.json with dependencies (jose, typescript, vitest)
    - Configure TypeScript with Node.js 20 target and dual ESM/CommonJS output
    - Add web-identity to root package.json workspaces array
    - _Requirements: 8.2_

- [ ]   2. Create core types and error classes

    - [x] 2.1 Implement TypeScript interfaces for token payloads

        - Define RequestTokenPayload, IssuanceTokenPayload, PresentationTokenPayload interfaces
        - Make iat optional in all payload types for testing expired tokens
        - Include KeyResolver callback type definition
        - _Requirements: 8.2_

    - [x] 2.2 Create custom error classes
        - Implement WebIdentityError base class with error codes
        - Create MissingClaimError, InvalidSignatureError, TimeValidationError, TokenFormatError
        - Ensure all errors include descriptive messages and error codes
        - _Requirements: 8.1, 8.3_

- [ ]   3. Implement utility functions

    - [x] 3.1 Create JWK validation utilities

        - Write function to validate JWK contains required alg, kid, and algorithm-specific parameters
        - Implement function to extract public key parameters for cnf claims
        - Create function to strip private key material from JWK
        - _Requirements: 8.3_

    - [x] 3.2 Implement time validation utilities

        - Create function to validate iat claims within 60-second window
        - Handle optional iat for testing scenarios
        - Provide consistent time validation across all token types
        - _Requirements: 2.4, 4.4, 6.6_

    - [x] 3.3 Create cryptographic utilities
        - Implement SHA-256 hash calculation for sd_hash
        - Create function to parse and validate JWT structure
        - Add email address syntax validation
        - _Requirements: 5.3, 6.4, 8.3_

- [ ]   4. Generate and verify test keys

    - [x] 4.1 Create test key files
        - Generate RSA key pair with kid "rsa-test-key-1" and RS256 algorithm
        - Generate EdDSA key pair with kid "eddsa-test-key-1" and Ed25519 curve
        - Create public_jwks.json with public keys only
        - Create private_jwks.json with complete key pairs for testing
        - _Requirements: 7.2, 7.3_

- [ ]   5. Implement and test RequestToken completely

    - [x] 5.1 Create generateRequestToken function

        - Accept RequestTokenPayload and JWK with private key
        - Extract alg and kid from JWK for JWT header
        - Embed public key in JWT header as jwk claim
        - Set iat to current time if not provided in payload
        - Sign JWT with private key from JWK
        - _Requirements: 1.1, 1.2, 1.3_

    - [x] 5.2 Create independent RequestToken verification test

        - Implement independent JWT parsing using Node.js crypto module
        - Parse JWT headers and payloads without using jose library
        - Verify signature using extracted public key from header
        - Test with both RSA and EdDSA generated tokens
        - _Requirements: 7.1, 7.2, 7.3_

    - [x] 5.3 Create verifyRequestToken function

        - Parse JWT and extract header and payload
        - Validate JWT structure and required claims (iss, aud, nonce, email)
        - Extract public key from jwk header claim
        - Verify JWT signature using extracted public key
        - Validate iat within 60-second window
        - Throw MissingClaimError for missing required claims
        - Return verified payload on success
        - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

    - [x] 5.4 Test RequestToken functions together
        - Test successful generation and verification with both RSA and EdDSA keys
        - Test missing claim errors for all required claims
        - Test time validation with expired tokens
        - Test invalid signature handling
        - Test malformed JWT structure
        - Verify generate/verify function compatibility
        - _Requirements: 1.4, 1.5, 2.4, 2.5, 2.7_

- [ ]   6. Implement and test IssuanceToken completely

    - [x] 6.1 Create generateIssuanceToken function

        - Accept IssuanceTokenPayload and JWK with private key
        - Set JWT type to "web-identity+sd-jwt" in header
        - Extract kid from JWK for header
        - Include only public key parameters in cnf.jwk claim
        - Set iat to current time if not provided in payload
        - Sign SD-JWT with issuer's private key
        - _Requirements: 3.1, 3.2, 3.3, 3.4_

    - [x] 6.2 Create independent IssuanceToken verification test

        - Extend independent JWT parsing for SD-JWT format
        - Verify "web-identity+sd-jwt" type in header
        - Parse cnf claim and validate public key parameters only
        - Test signature verification with issuer keys
        - Test with both RSA and EdDSA generated tokens
        - _Requirements: 7.1, 7.2, 7.3_

    - [x] 6.3 Create verifyIssuanceToken function

        - Parse SD-JWT and validate structure
        - Verify required claims (iss, cnf, email, email_verified)
        - Validate email_verified is true
        - Resolve issuer's public key using KeyResolver callback
        - Verify SD-JWT signature using issuer's public key
        - Validate iat within 60-second window
        - Throw MissingClaimError for missing required claims
        - Return verified payload on success
        - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

    - [x] 6.4 Test IssuanceToken functions together
        - Test successful generation and verification with both key types
        - Test email_verified validation
        - Test cnf claim contains only public key parameters
        - Test missing claim errors
        - Test time validation boundaries
        - Verify generate/verify function compatibility
        - _Requirements: 3.5, 3.6, 4.4, 4.5, 4.7_

- [ ]   7. Implement and test PresentationToken completely

    - [x] 7.1 Create generatePresentationToken function

        - Accept SD-JWT string, audience, nonce, and JWK with private key
        - Calculate SHA-256 hash of SD-JWT for sd_hash claim
        - Create KB-JWT with type "kb+jwt" and required claims (aud, nonce, iat, sd_hash)
        - Set iat to current time if not provided
        - Sign KB-JWT with browser's private key
        - Concatenate SD-JWT and KB-JWT with tilde separator
        - _Requirements: 5.1, 5.2, 5.3, 5.4_

    - [x] 7.2 Create independent PresentationToken verification test

        - Parse SD-JWT+KB by splitting on tilde separator
        - Independently verify both SD-JWT and KB-JWT components
        - Verify sd_hash calculation matches SHA-256 of SD-JWT
        - Test signature verification using public key from SD-JWT cnf claim
        - Test cross-algorithm scenarios (RSA browser, EdDSA issuer)
        - _Requirements: 7.1, 7.2, 7.3_

    - [x] 7.3 Create verifyPresentationToken function

        - Parse SD-JWT+KB by splitting on tilde separator
        - Verify KB-JWT signature using public key from SD-JWT cnf claim
        - Validate KB-JWT claims (aud, nonce, iat, sd_hash)
        - Verify sd_hash matches SHA-256 hash of SD-JWT
        - Verify SD-JWT using same logic as verifyIssuanceToken
        - Validate all iat claims within 60-second window
        - Throw MissingClaimError for missing required claims
        - Return both SD-JWT and KB-JWT verified payloads
        - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

    - [x] 7.4 Test PresentationToken functions together
        - Test successful generation and verification
        - Test sd_hash calculation and validation
        - Test tilde separator parsing
        - Test cross-algorithm scenarios (RSA browser, EdDSA issuer)
        - Test missing claim errors in both SD-JWT and KB-JWT
        - Verify generate/verify function compatibility
        - _Requirements: 5.5, 5.6, 6.7, 6.9_

- [ ]   8. Create package exports and build configuration

    - [x] 8.1 Configure build system

        - Set up TypeScript compilation for ESM and CommonJS outputs
        - Generate TypeScript declaration files
        - Configure package.json exports for dual module support
        - _Requirements: 8.2_

    - [x] 8.2 Create main index file
        - Export all public functions and types
        - Ensure clean API surface with proper TypeScript types
        - Document all exported functions with JSDoc comments
        - _Requirements: 8.2_

- [ ]   9. End-to-end integration testing

    - [x] 9.1 Complete token flow testing

        - Test complete flow: RequestToken → IssuanceToken → PresentationToken
        - Verify token compatibility across all generate/verify function pairs
        - Test error propagation through the complete flow
        - Test all algorithm combinations (RSA/EdDSA) across token types
        - _Requirements: 7.4, 7.5_

    - [x] 9.2 Performance and security validation
        - Benchmark token generation and verification performance
        - Validate no private key material leaks in public claims
        - Test memory cleanup of sensitive data
        - Verify algorithm support and security properties
        - _Requirements: 8.1, 8.3_

- [x]   10. Implement DNS-based issuer discovery

    - [x] 10.1 Create DNS discovery utilities

        - Implement discoverIssuer function with DNS TXT record lookup at email.\_web-identity.$EMAIL_DOMAIN
        - Add domain validation with comprehensive format checking and length constraints
        - Implement case normalization for issuer identifiers
        - Add validation for iss= record format and reject URLs
        - Handle multiple iss records with error indicating spec should allow only one
        - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

    - [x] 10.2 Create metadata and JWKS fetching functions

        - Implement fetchWebIdentityMetadata with /.well-known/web-identity endpoint
        - Add redirect support with validation that final URL ends with issuer domain
        - Validate required metadata fields (issuance_endpoint, jwks_uri)
        - Implement fetchJWKS with JWKS structure validation
        - Add timeout support with configurable values and AbortController
        - Create proper error handling with DNSDiscoveryError and JWKSFetchError types
        - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

    - [x] 10.3 Add caching and performance optimization

        - Implement in-memory caching for both metadata and JWKS with configurable timeouts
        - Add cache hit/miss logic with timestamp-based expiration
        - Create clearCaches utility function for testing and cache management
        - Add RequestOptions interface for timeout and cache timeout configuration
        - Optimize network requests with proper timeout handling
        - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

    - [x] 10.4 Create comprehensive DNS discovery tests
        - Write 35 test cases covering all DNS discovery functions
        - Mock DNS module and fetch API for isolated testing
        - Test all error conditions: DNS failures, HTTP errors, validation failures
        - Test caching behavior, timeout handling, and redirect validation
        - Test domain validation edge cases and security scenarios
        - Add integration test for complete discovery flow
        - _Requirements: 9.1-9.7, 10.1-10.9, 11.1-11.6_

- [x]   11. Update documentation and exports

    - [x] 11.1 Add DNS discovery functions to main exports

        - Export discoverIssuer, fetchWebIdentityMetadata, fetchJWKS, clearCaches
        - Export WebIdentityMetadata, JWKSResponse, RequestOptions types
        - Add DNSDiscoveryError and JWKSFetchError to error exports
        - Update KeyResolver type to include Uint8Array for jose library compatibility
        - _Requirements: 8.2, 9.1-9.7, 10.1-10.9_

    - [x] 11.2 Update README with DNS discovery documentation
        - Add comprehensive DNS Discovery Functions section with examples
        - Document DNS record format and setup requirements
        - Add new types to Types section
        - Update error handling examples with new error types
        - Add DNS discovery functions to import examples and utility functions
        - _Requirements: 8.2, 9.1-9.7, 10.1-10.9_

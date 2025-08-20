# Requirements Document

## Introduction

The `web-identity` package provides TypeScript functions for generating and verifying JWT tokens used in the Verified Email Autocomplete protocol. This package implements the core cryptographic operations for RequestToken (steps 3.4 & 4.1), IssuedToken (steps 4.2 & 5.1), and PresentationToken (steps 5.2 & 6.2-6.4) as defined in the web-identity specification. The package will support multiple JWT processing libraries and provide a consistent API for token generation and verification operations.

## Requirements

### Requirement 1

**User Story:** As a browser implementation developer, I want to generate RequestTokens with embedded public keys, so that I can request verified email tokens from issuers.

#### Acceptance Criteria

1. WHEN a developer calls generateRequestToken with a payload object and JWK THEN the system SHALL create a JWT with the public key in the header as a `jwk` claim
2. WHEN generating a RequestToken THEN the system SHALL include required claims: `iss`, `aud`, `iat`, `nonce`, and `email` in the payload
3. WHEN generating a RequestToken THEN the system SHALL sign the JWT with the corresponding private key
4. WHEN the payload contains invalid data THEN the system SHALL throw a descriptive error
5. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 2

**User Story:** As an issuer service developer, I want to verify RequestTokens from browsers, so that I can validate the authenticity and integrity of email verification requests.

#### Acceptance Criteria

1. WHEN a developer calls verifyRequestToken with a JWT string and key resolver callback THEN the system SHALL parse and validate the JWT structure
2. WHEN verifying a RequestToken THEN the system SHALL extract the `jwk` from the header and verify the signature using that public key
3. WHEN verifying a RequestToken THEN the system SHALL validate all required claims: `aud`, `iat`, `email`, and `nonce`
4. WHEN the `iat` claim is more than 60 seconds old THEN the system SHALL throw a time validation error
5. WHEN the JWT signature is invalid THEN the system SHALL throw a signature verification error
6. WHEN verification succeeds THEN the system SHALL return the verified payload object
7. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 3

**User Story:** As an issuer service developer, I want to generate IssuedTokens (SD-JWTs) for verified email addresses, so that browsers can present them to relying parties.

#### Acceptance Criteria

1. WHEN a developer calls generateIssuedToken with a payload object and JWK THEN the system SHALL create an SD-JWT with type "web-identity+sd-jwt"
2. WHEN generating an IssuedToken THEN the system SHALL include required claims: `iss`, `iat`, `cnf`, `email`, and `email_verified` in the payload
3. WHEN generating an IssuedToken THEN the system SHALL embed the browser's public key from the RequestToken in the `cnf` claim
4. WHEN generating an IssuedToken THEN the system SHALL include a `kid` in the header for key identification
5. WHEN the payload is missing required fields THEN the system SHALL throw a validation error
6. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 4

**User Story:** As a browser implementation developer, I want to verify IssuedTokens from issuers, so that I can validate the authenticity before creating presentation tokens.

#### Acceptance Criteria

1. WHEN a developer calls verifyIssuedToken with an SD-JWT string and key resolver callback THEN the system SHALL parse and validate the SD-JWT structure
2. WHEN verifying an IssuedToken THEN the system SHALL validate the signature using the issuer's public key identified by `kid`
3. WHEN verifying an IssuedToken THEN the system SHALL validate required claims: `iss`, `iat`, `cnf`, `email`, and `email_verified`
4. WHEN the `iat` claim is more than 60 seconds old THEN the system SHALL throw a time validation error
5. WHEN the `email_verified` claim is not true THEN the system SHALL throw a verification error
6. WHEN verification succeeds THEN the system SHALL return the verified payload object
7. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 5

**User Story:** As a browser implementation developer, I want to generate PresentationTokens (SD-JWT+KB), so that I can present verified email tokens to relying parties with key binding.

#### Acceptance Criteria

1. WHEN a developer calls generatePresentationToken with an SD-JWT, audience, nonce, and private key THEN the system SHALL create a Key Binding JWT (KB-JWT)
2. WHEN generating a PresentationToken THEN the system SHALL create a KB-JWT with type "kb+jwt" and required claims: `aud`, `nonce`, `iat`, and `sd_hash`
3. WHEN generating a PresentationToken THEN the system SHALL compute the SHA-256 hash of the SD-JWT for the `sd_hash` claim
4. WHEN generating a PresentationToken THEN the system SHALL concatenate the SD-JWT and KB-JWT with a tilde (~) separator
5. WHEN the SD-JWT is invalid THEN the system SHALL throw a validation error
6. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 6

**User Story:** As a relying party developer, I want to verify PresentationTokens from browsers, so that I can validate verified email addresses with key binding proof.

#### Acceptance Criteria

1. WHEN a developer calls verifyPresentationToken with an SD-JWT+KB string and key resolver callback THEN the system SHALL parse both the SD-JWT and KB-JWT components
2. WHEN verifying a PresentationToken THEN the system SHALL verify the KB-JWT signature using the public key from the SD-JWT's `cnf` claim
3. WHEN verifying a PresentationToken THEN the system SHALL validate KB-JWT claims: `aud`, `nonce`, `iat`, and `sd_hash`
4. WHEN verifying a PresentationToken THEN the system SHALL verify the `sd_hash` matches the SHA-256 hash of the SD-JWT
5. WHEN verifying a PresentationToken THEN the system SHALL verify the SD-JWT signature using the issuer's public key
6. WHEN verifying a PresentationToken THEN the system SHALL validate SD-JWT claims: `iss`, `iat`, `cnf`, `email`, and `email_verified`
7. WHEN any verification step fails THEN the system SHALL throw a descriptive error
8. WHEN verification succeeds THEN the system SHALL return both the SD-JWT and KB-JWT verified payloads
9. WHEN a required claim is missing THEN the system SHALL throw a missing_claim error

### Requirement 7

**User Story:** As a developer testing the package, I want an independent test suite that can verify generated tokens, so that I can ensure the correctness of token generation and parsing without relying on the same implementation.

#### Acceptance Criteria

1. WHEN the test suite runs THEN the system SHALL independently parse and verify tokens generated by the package functions
2. WHEN testing token generation THEN the system SHALL use separate signature verification logic to validate generated tokens
3. WHEN testing token parsing THEN the system SHALL verify that parsed claims match expected values
4. WHEN running the test suite THEN the system SHALL validate token structure, signatures, and claim integrity independently
5. WHEN a generated token is malformed THEN the independent verification SHALL detect and report the issue

### Requirement 8

**User Story:** As a developer integrating the package, I want comprehensive error handling and TypeScript support, so that I can build robust applications with good developer experience.

#### Acceptance Criteria

1. WHEN any function encounters an error THEN the system SHALL throw typed errors with descriptive messages
2. WHEN using TypeScript THEN the system SHALL provide complete type definitions for all functions and interfaces
3. WHEN a function receives invalid parameters THEN the system SHALL validate inputs and throw appropriate errors
4. WHEN working with JWKs THEN the system SHALL support standard key formats and validate key compatibility with algorithms

### Requirement 9

**User Story:** As a developer implementing the Verified Email Autocomplete protocol, I want DNS-based issuer discovery functions, so that I can automatically find and connect to email domain issuers.

#### Acceptance Criteria

1. WHEN a developer calls discoverIssuer with an email address or domain THEN the system SHALL perform DNS TXT record lookup at `email._web-identity.$EMAIL_DOMAIN`
2. WHEN discovering an issuer THEN the system SHALL find TXT records with format `iss=issuer.example` and return the issuer identifier
3. WHEN multiple iss records are found THEN the system SHALL throw an error indicating the spec should allow only one record
4. WHEN no iss record is found THEN the system SHALL throw a DNSDiscoveryError with descriptive message
5. WHEN DNS lookup fails THEN the system SHALL throw a DNSDiscoveryError with the underlying error details
6. WHEN domain format is invalid THEN the system SHALL validate and throw appropriate errors
7. WHEN issuer identifier format is invalid THEN the system SHALL validate and reject URLs or malformed domains

### Requirement 10

**User Story:** As a developer implementing the Verified Email Autocomplete protocol, I want to fetch issuer metadata and JWKS, so that I can obtain the necessary endpoints and public keys for token verification.

#### Acceptance Criteria

1. WHEN a developer calls fetchWebIdentityMetadata with an issuer identifier THEN the system SHALL fetch from `https://issuer.example/.well-known/web-identity`
2. WHEN fetching metadata THEN the system SHALL follow redirects to subdomains of the same issuer domain
3. WHEN metadata is fetched THEN the system SHALL validate required fields: `issuance_endpoint` and `jwks_uri`
4. WHEN metadata contains URLs THEN the system SHALL validate that all URLs end with the issuer domain
5. WHEN a developer calls fetchJWKS with a JWKS URI THEN the system SHALL fetch and validate the JWKS structure
6. WHEN fetching JWKS THEN the system SHALL validate that keys contain required fields: `kty` and `kid`
7. WHEN HTTP requests fail THEN the system SHALL throw JWKSFetchError with status and error details
8. WHEN responses have invalid content types THEN the system SHALL throw appropriate errors
9. WHEN requests timeout THEN the system SHALL respect configurable timeout values and throw timeout errors

### Requirement 11

**User Story:** As a developer using DNS discovery functions, I want caching and performance optimization, so that my application can efficiently handle repeated requests without unnecessary network calls.

#### Acceptance Criteria

1. WHEN metadata or JWKS is fetched THEN the system SHALL cache results in memory with configurable timeout
2. WHEN cached data is available and not expired THEN the system SHALL return cached results without making network requests
3. WHEN cache timeout is reached THEN the system SHALL fetch fresh data and update the cache
4. WHEN a developer calls clearCaches THEN the system SHALL clear all cached metadata and JWKS data
5. WHEN requests are made with custom timeout values THEN the system SHALL respect the specified timeout
6. WHEN requests are made with custom cache timeout THEN the system SHALL use the specified cache duration

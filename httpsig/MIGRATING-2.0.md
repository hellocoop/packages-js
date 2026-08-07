# Migrating to 2.0

2.0 tracks `draft-hardt-httpbis-signature-key-08`, published to the IETF
datatracker on 2026-08-05, which is not backward
compatible with the `-05`-era protocol that 1.x implements. A 1.x client and a
2.x verifier will not interoperate, in either direction. There is no version
negotiation in the protocol, so both ends have to move together.

1.x continues on the `1.x` branch.

## Every JWK must carry `alg`

This is the change that touches most callers.

The algorithm is now taken from the JWK's `alg` member and is never derived
from `kty` and `crv`. Those underdetermine it: an RSA key has no `crv` at all
and leaves both padding and hash free, and an EC key's curve does not fix the
hash.

`alg` must be a _fully-specified_ identifier (RFC 9864). The polymorphic
`EdDSA` identifier is rejected — use `Ed25519` or `Ed448`.

```js
// 1.x
const key = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

// 2.x — WebCrypto does not set alg, so set it yourself
const key = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
key.alg = 'Ed25519'
```

`generateKeyPair()` from this package stamps `alg` for you, so prefer it:

```js
import { generateKeyPair } from '@hellocoop/httpsig'
const { privateKey, publicKey } = await generateKeyPair({
    algorithm: 'Ed25519',
})
```

A JWK whose `kty` or `crv` disagrees with its `alg` is rejected rather than
resolved in favour of either reading.

Supported: `Ed25519`, `Ed448`, `ES256`, `ES384`, `ES512`, `PS256`, `PS384`,
`PS512`, `RS256`, `RS384`, `RS512`. RSA is newly supported in 2.0. Symmetric
algorithms (`oct`, `HS*`, `hmac-sha256`) are rejected: every scheme here
distributes a public key, and a shared secret handed to the verifier proves
nothing.

`ML-DSA-*` and the `AKP` key type are recognized and declined with
`unsupported_algorithm` rather than failing as malformed. WebCrypto cannot
implement them.

## The `alg` signature parameter is not used

RFC 9421 Section 1.4 gives three ways to establish the algorithm — state it in
the `alg` signature parameter, derive it from the key material, or agree it out
of band. This package takes the second, which Section 3.3.7 develops for JOSE
signing algorithms: _"the explicit `alg` signature parameter is not used at all
when using JOSE signing algorithms."_

So `fetch()` never emits `alg` in `Signature-Input`, and `verify()` ignores one
if a signer sends it. A signer that declares a misleading `alg` does not change
which operation the verifier performs — the key decides.

Ignoring is not the same as discarding: `alg` lives inside
`@signature-params`, which is covered by the signature, so it is still
reproduced verbatim when the signature base is reconstructed. Dropping it would
change the base and fail verification.

Nothing changes for callers — 1.x behaved this way too — but it is now
guaranteed and tested rather than incidental.

Note this is only the **Signature-Input** `alg`. The `alg` member of a JWK is
required (above), and `Accept-Signature`'s own `alg` parameter is unaffected.

## New: `supportedAlgorithms`

A verifier now declares which algorithms it accepts. A key whose `alg` falls
outside that set is rejected with `unsupported_algorithm`, and the set comes
back on the result so you can send it in an `Accept-Signature-Alg` response
header.

```js
const result = await verify(request, {
    supportedAlgorithms: ['Ed25519', 'ES256'],
})

if (result.signatureError?.error === 'unsupported_algorithm') {
    res.setHeader(
        'Accept-Signature-Alg',
        generateAcceptSignatureAlgHeader(result.acceptSignatureAlg),
    )
}
```

Defaults to every algorithm the library implements, exported as
`SUPPORTED_ALGORITHMS`, so omitting it changes nothing. Narrow it to decline an
algorithm by policy — refusing RSASSA-PKCS1-v1_5 while still implementing it,
say. Declining by policy and not implementing at all report the same code;
the difference is only which set you advertise.

Note the accepted set travels on the **result**, not inside `SignatureError`.
The `supported_algorithms` member of `Signature-Error` was removed in `-08`.

## Discovery metadata must carry a matching `issuer`

New in `-08`. The metadata document at `{id}/.well-known/{dwk}` must contain an
`issuer` member equal to `id`, compared by byte equality with no normalization
— a trailing slash is a different identifier.

Two new error codes: `issuer_missing` and `issuer_mismatch`.

This is the check RFC 8414 Section 3.3 requires of authorization server
metadata. Without it a document served under one identity — misconfigured
shared hosting, a subdomain takeover — could point `jwks_uri` at keys belonging
to someone else, and the verifier would attribute the request to the identity
in the header. 1.x followed `jwks_uri` without checking.

Documents conforming to RFC 8414 or OpenID Connect Discovery already carry
`issuer`, so existing metadata is unaffected. A hand-rolled `.well-known`
document that omits it will now be rejected.

## Unusable keys elsewhere in a JWKS are ignored

A verifier resolving a key from a JWKS selects the member matching `kid`
without requiring any other member to be usable, and does not fail because
some other entry names a key type it cannot parse.

This is what lets a signer introduce a new algorithm at all: an issuer adding
a post-quantum key alongside a classical one would otherwise break every
verifier that does not implement the new type, including verifiers only ever
going to use the classical key.

Behaviour is unchanged from 1.x — the library already selected by `kid`
without parsing the rest — but it is now specified and tested.

## `hwk` carries `alg` and must not carry `kid`

The `hwk` scheme now emits and requires an `alg` parameter. It was forbidden
through `-07`, so a header serialized by 1.x is rejected by 2.x and vice versa.

```
# 1.x
Signature-Key: sig=hwk;kty="OKP";crv="Ed25519";x="..."

# 2.x
Signature-Key: sig=hwk;alg="Ed25519";kty="OKP";crv="Ed25519";x="..."
```

A `kid` parameter on `hwk` is now rejected: the key is inline, so an identifier
selects nothing, and one that disagrees with the inline key has no defined
resolution.

## `sigkey` is replaced by two header fields

A Structured Fields parameter value is a bare Item and cannot be a list, so
`sigkey` could name only one scheme. It is replaced by `Accept-Signature-Scheme`
and `Accept-Signature-Alg`, which are Lists of Tokens and let a client choose
before it signs rather than after a rejection.

```js
// 1.x
generateAcceptSignatureHeader({ label: 'sig', components, sigkey: 'jkt' })

// 2.x
generateAcceptSignatureHeader({ label: 'sig', components })
generateAcceptSignatureSchemeHeader(['hwk', 'jkt-jwt'])
generateAcceptSignatureAlgHeader(['Ed25519', 'ES256'])
```

The `SigKeyValue` type is removed.

## `supported_algorithms` is removed from `Signature-Error`

Use `Accept-Signature-Alg`, which works on a challenge and on an error alike,
rather than only after a rejection.

The `unsupported_scheme` error code is added, and an unrecognized
`Signature-Key` scheme now reports it instead of `invalid_key`.

## `signature-key` coverage is always enforced

The `strictAAuth` option is removed from `VerifyOptions`. Covering
`signature-key` is a requirement of the specification, not a profile choice: an
uncovered `Signature-Key` header can be substituted by an attacker without
invalidating the signature. There is no way to disable the check.

Requests whose covered components omit `signature-key` are rejected with
`invalid_input`, and `required_input` names what was missing.

## The `jwt` scheme validates `exp`

1.x extracted `cnf.jwk` and validated nothing, leaving expiry to the caller.
2.x requires `exp` and rejects an expired assertion with `expired_jwt`, because
`exp` is what bounds how long the confirmation key the assertion carries
remains acceptable. An assertion without `exp` leaves that key acceptable
indefinitely.

`iat`, if present, must not be in the future.

Validating the issuer's signature over the assertion remains the caller's job.

## Errors are typed

Verification failures now throw `SignatureVerificationError`, which carries the
`Signature-Error` code directly instead of leaving it to be recovered by
matching on message text.

```js
import { SignatureVerificationError } from '@hellocoop/httpsig'

try {
    await fetch(url, opts)
} catch (error) {
    if (error instanceof SignatureVerificationError) {
        console.log(error.code) // e.g. 'invalid_key'
    }
}
```

`verify()` still returns a result object rather than throwing; its
`signatureError` member is now derived from the code rather than the message.

## Not yet implemented

The `jwks`, `self-jwt`, and `x509` schemes are defined by the draft but not
implemented here. Assertion caching — the `cached` scheme, `Signature-Key-Cache`
and `cache_miss` — is deliberately not implemented: the draft carries an
Editor's Note calling it a straw man, and the design is not settled.

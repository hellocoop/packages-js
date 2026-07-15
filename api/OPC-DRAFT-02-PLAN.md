# Plan: bring `@hellocoop/api` OPC support to draft-02

## Why

`@hellocoop/api` is the SDK apps use to integrate Hellō. It already contains an OPC
command handler (`src/handlers/command.ts`), so any app on the Hellō SDK can expose a
command endpoint that receives lifecycle commands (suspend, delete, invalidate) from
the Hellō OP (the Lifecycle service). **This is the adoption lever for OPC: get the
SDK right and every Hellō RP gets deprovisioning support nearly for free** — they
write a small handler, the SDK does token verification and the command envelope.

The handler is **draft-00/01 era** and, more importantly, **not actually wired up**.
This plan brings it to [OPC draft-02](https://github.com/openid/openid-provider-commands)
and matches what the Lifecycle OP now sends.

This is separate work in a separate repo with its own npm publish cycle — it does not
ride any Lifecycle deploy.

## Current state (verified)

- **Package**: `@hellocoop/api` v2.5.2. **`jose` is not a dependency.**
- **Token verification** (`src/handlers/command.ts` `verifyCommandToken`): decodes the
  JWT payload unverified, looks `iss` up in a hardcoded `issuers` map, and **POSTs the
  token to that issuer's OAuth introspection endpoint** — no signature check, no `typ`
  check, no `aud` check. The introspection JSON is used as the claims.
- **Metadata response** (`handleMetadata`): draft-00/01 shape —
  `{ context: {package_name, package_version, iss, tenant?}, commands_uri, commands_supported, commands_ttl, client_id }`.
- **`Command` union** (`src/types.ts`): uses `unauthorize` / `unauthorize_tenant`;
  missing `maintain`, `audit`, `migrate`, and all `_async` variants.
- **Wiring gap (the big one)**: `configure()` in `src/lib/config.ts` **never reads
  `config.commandHandler`**, and the app-facing `Config` type in `types.ts` doesn't
  include it. So `config.commandHandler` is always `undefined` at runtime — today only
  the built-in `metadata` command works and **an app cannot register a handler at all.**
- **Routing**: a POST carrying a `command_token` form field to the API route (default
  `/api/hellocoop`) → `router.ts` → `handleCommand`. All framework adapters (express,
  fastify, nextjs, svelte, vue) share this one handler; **no per-adapter command code.**
- **Reusable prior art**: `httpsig/src/verify.ts` has a self-contained JWKS fetch+cache
  (`fetchJWKS`, `getPublicKeyFromJWKS`, `.well-known` discovery) not using jose. Usable,
  but `jose` is the cleaner path for a `typ=command+jwt` JWT verifier.

## Target (draft-02)

1. **Verify the command token as a signed JWT**, not by introspection:
    - `typ` JWS header MUST be `command+jwt`.
    - Signature verified against the OP's **JWKS** (discovered via `iss` +
      `/.well-known/openid-configuration` → `jwks_uri`, or a configured `jwks_uri`).
    - `aud` MUST equal this RP's command endpoint URL.
    - `exp` in the future; reject if `nonce` is present.
2. **Metadata response** = `{ context: {iss, tenant}, command_endpoint, commands_supported, client_id, aud_sub_required? }`. Drop `package_name`/`package_version`/`commands_ttl`; rename `commands_uri` → `command_endpoint`.
3. **`Command` union**: `unauthorize` → `invalidate`, `unauthorize_tenant` → `invalidate_tenant`; add `maintain`, `audit`, `migrate` and the `_async` variants.
4. **Wire `commandHandler`** so apps can actually register one.

## Changes, by file

### `api/package.json`

- Add `jose` (`^5`) to `dependencies`. It's the only new runtime dep.

### `api/src/types.ts`

- Rewrite the `Command` union to draft-02:
    ```ts
    export type Command =
        | 'metadata'
        | 'activate'
        | 'maintain'
        | 'suspend'
        | 'reactivate'
        | 'archive'
        | 'restore'
        | 'delete'
        | 'audit'
        | 'invalidate'
        | 'migrate'
        | 'audit_tenant'
        | 'suspend_tenant'
        | 'archive_tenant'
        | 'delete_tenant'
        | 'invalidate_tenant'
    // optionally the _async variants if the RP supports async
    ```
- Extend `CommandClaims` with the draft-02 claims the handler now validates/exposes:
  `aud`, `client_id`, `iat`, `exp`, `jti`, `aud_sub?`, and profile claims
  (`email`, `email_verified`, `given_name`, `family_name`, `name`, `groups`, `roles`).
- **Add `commandHandler` to the app-facing `Config` type** (currently only on the
  internal `IConfig`) so apps can pass one.
- Change `CommandHandler` return type to `void | Promise<void>` (it's already used with
  `async`).

### `api/src/lib/config.ts`

- In `configure()`, **assign `config.commandHandler` onto the configuration** (the
  missing wire). Optionally accept `config.commandsSupported` and `config.audSubRequired`
  so the built-in metadata response reflects what the app supports.

### `api/src/handlers/command.ts` — the core

- Replace `verifyCommandToken`:
    - Read the protected header; reject unless `typ === 'command+jwt'`.
    - Resolve the OP's JWKS: extend the `issuers` map to carry `jwks_uri` (the field
      already exists, unused), or discover it from `iss` + `/.well-known/openid-configuration`.
      Cache the JWKS (jose's `createRemoteJWKSet` caches internally).
    - `jose.jwtVerify(token, jwks, { typ: 'command+jwt', audience: <this command endpoint> })`.
    - On any failure return a typed error → `400 invalid_request`; unknown `iss` →
      `401 unrecognized_provider`.
- Rewrite `handleMetadata` to the draft-02 response shape (above), sourcing
  `commands_supported` from config (default `['metadata']`), `command_endpoint` from
  `config.redirectURI`, and `aud_sub_required` from config.
- Keep the delegation seam: `metadata` handled built-in unless overridden; everything
  else → `config.commandHandler(res, claims)`; unknown/unset → `400 unsupported_command`.
- Fix the no-token path (currently `res.status(500)` with no body) to
  `400 invalid_request`.

### Adapters

- **No command-logic changes.** The express/fastify/nextjs/svelte/vue adapters route to
  the shared handler and need no edits. Confirm each still passes the metadata test.

### Tests

- Update the metadata assertions to the new shape:
    - `fastify/spec/metadata.spec.mjs`: expect `command_endpoint` (not `commands_uri`),
      `context: {iss, tenant}` (no `package_*`), drop `commands_ttl`.
    - `express/tests/express.spec.ts` (`'should get metadata'`, ~lines 261–285): same.
- **Add a real signature-verification test** in `api/` (new — there is none today):
  sign a `command+jwt` with a test key, serve its JWKS, and assert the handler accepts a
  good token and rejects (a) wrong `typ`, (b) bad signature, (c) wrong `aud`, (d) expired.
  This is the first unit test of the verifier and the thing most worth having.
- The `mockin` harness (`GET /command/mock`, `POST /oauth/introspect`) must be updated
  in parallel to mint `command+jwt` tokens and expose a JWKS instead of introspection —
  tracked as its own change (the mockin repo), noted in the Lifecycle roadmap Phase 3.

## Release

- Lerna independent versioning. Bump `@hellocoop/api` (minor — additive API: apps can
  now register a handler; the metadata shape change is technically breaking for any app
  asserting the old fields, so consider **major** for `api` if strict semver).
- `./scripts/release.sh` from a clean `main`: build, `lerna run test`, `lerna version`,
  push tags, `gh release create` → the `release.yml` workflow publishes changed packages
  to npm with provenance.
- Adapters that only re-export `api` will get a version bump via their dependency range;
  verify each adapter's published range picks up the new `api`.

## Related: `cdk-client` — invoking a developer's Lambda on a command

`@hellocoop/cdk-client` (`/Users/dick/github/HelloCoop/cdk-client`) is the CDK construct
serverless developers use to deploy a Hellō-integrated Lambda: `HelloClientConstruct`
creates a Lambda with a **public function URL** (`authType: NONE`) running the Hellō
client protocol handler (`protocol/index.ts`). That function URL **is** the app's OPC
command endpoint — once the SDK is draft-02, a `command_token` POST to it is verified
and dispatched with no extra infra.

But a Lambda app usually needs to run _its own_ logic when a command arrives (actually
suspend/delete the user in its system), and the construct already has the exact pattern
for this: **`loginSyncFunctionName`** — on login, the client Lambda invokes a developer
Lambda, with `lambda:InvokeFunction` granted to its role (`src/client.ts:103-113`) and
the invoke done via `InvokeCommand` (`protocol/index.ts:49-56`).

Add the command analogue:

1. **`src/client.ts`** — new prop `commandSyncFunctionName?` → build its ARN from region/
   account (as `loginSyncFunctionArn` is built), and attach a `lambda:InvokeFunction`
   policy for it (copy the `if (loginSyncFunctionArn) { … }` block). Pass its ARN into
   the function env (e.g. `HELLO_COMMAND_SYNC_ARN`).
2. **`protocol/index.ts`** — when the SDK reports an OPC command (via the draft-02
   `commandHandler` wired in the SDK config change above), `InvokeCommand` the
   command-sync Lambda with the command claims, mirroring the login-sync path. The
   handler's response (the account state) becomes the OPC command response.
3. This depends on the SDK change that makes `configure()` actually read
   `config.commandHandler` — the construct sets a handler that forwards to the
   command-sync Lambda.

So the full serverless story: `cdk-client` (deploys the endpoint + invoke wiring) +
`@hellocoop/api` draft-02 (verifies the token, routes to the handler) →
the developer writes only their `commandSyncFunctionName` Lambda. This is the same
"write one Lambda" ergonomics as login sync, and it's the reason the SDK work and the
cdk-client work ship together.

## Sequencing note

Do the **metadata reshape + Command rename + commandHandler wiring** first (small,
unblocks apps registering handlers), then the **JWKS verification** (the security
substance), then the **cdk-client `commandSyncFunctionName`** (depends on the wired
handler). Ship the SDK behind a minor/major bump only once the mockin harness mints
`command+jwt`, so the adapter tests stay green.

/**
 * Key discovery for identified signers.
 *
 * Resolves `{id}/.well-known/{dwk}` -> `jwks_uri` -> JWKS -> `kid`, which is
 * the lookup the jwks_uri scheme performs (draft-hardt-httpbis-signature-key,
 * JWKS URI Discovery) and the same lookup a caller performs for the issuer of
 * a jwt-scheme assertion (`iss` + `dwk` + `kid`).
 *
 * Three concerns are kept apart:
 *
 *   - Policy lives here: issuer binding, the refetch floor, refresh on an
 *     unknown `kid`, TTL from Cache-Control clamped to a floor and a cap, a
 *     fetch timeout, a response size limit, in-flight dedupe.
 *   - The store is injected (`store`). The default is a bounded in-memory
 *     cache; a deployment that runs many short-lived instances supplies a
 *     shared one.
 *   - The fetch is injected (`fetch`). Egress admission that needs the
 *     network -- private address filtering, pinning the resolved address --
 *     can only be done there.
 *
 * `onFetch` reports every outbound fetch with the reason it was made, so a
 * deployment can log key discovery.
 */

import { BoundedTtlCache } from './utils/cache.js'
import {
    SignatureVerificationError,
    issuerMissing,
    issuerMismatch,
} from './errors.js'
import type { SignatureErrorCode } from './types.js'

/** The subset of `fetch` the resolver needs. */
export type KeyFetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * One cached document, keyed by its URL.
 *
 * A failed fetch is stored too (`body: null`): that is what holds the refetch
 * floor against a signer whose documents cannot be fetched.
 */
export interface KeyStoreEntry {
    /** The parsed JSON document, or null when no fetch has succeeded. */
    body: unknown | null
    /** Epoch ms of the fetch that produced `body`; 0 when `body` is null. */
    fetchedAt: number
    /** Epoch ms of the most recent fetch attempt, successful or not. */
    attemptedAt: number
    /** Epoch ms until which `body` is fresh. */
    freshUntil: number
    /** Why the most recent attempt failed, when it did. */
    error?: string
    /** The Signature-Error code of that failure, when it had one. */
    errorCode?: SignatureErrorCode
}

/**
 * Where fetched documents are kept.
 *
 * Entries are created by unauthenticated callers -- the URL comes from the
 * request being verified -- so an implementation MUST bound how many it
 * holds. `ttlMs` is how long the entry is worth keeping; an implementation
 * may drop it sooner.
 */
export interface KeyStore {
    get(
        url: string,
    ): KeyStoreEntry | undefined | Promise<KeyStoreEntry | undefined>
    set(url: string, entry: KeyStoreEntry, ttlMs: number): void | Promise<void>
}

/** Why a document was fetched. */
export type KeyFetchReason =
    /** Nothing usable was cached. */
    | 'cold'
    /** The cached document had passed its TTL. */
    | 'expired'
    /** The cached JWKS had no key with the presented `kid`. */
    | 'unknown_kid'
    /** A signature failed to verify under the cached key. */
    | 'verify_failed'

/** Reported to `onFetch` after every outbound fetch. */
export interface KeyFetchEvent {
    url: string
    doc: 'metadata' | 'jwks'
    id: string
    dwk: string
    kid?: string
    reason: KeyFetchReason
    ok: boolean
    /** HTTP status, when a response arrived. */
    status?: number
    duration_ms: number
    /** Present when `ok` is false. `timeout` when the fetch timed out. */
    error?: string
    /** How long the fetched document will be treated as fresh. */
    ttl_ms?: number
    /** True when the fetch failed and a previously cached copy was used. */
    served_stale?: boolean
}

export interface KeyResolverOptions {
    /** Where documents are cached. Default: in memory, 100 entries, LRU. */
    store?: KeyStore

    /**
     * The fetch used for metadata and JWKS. Default: `globalThis.fetch`.
     * Called with `redirect: 'manual'` and an abort signal for `timeoutMs`;
     * the resolver refuses any redirect response itself. (`'error'` is not
     * accepted by Cloudflare Workers.)
     */
    fetch?: KeyFetch

    /** Fetch timeout, covering the body. Default: 5000. */
    timeoutMs?: number

    /** Largest response body accepted. Default: 1048576 (1 MiB). */
    maxResponseBytes?: number

    /**
     * Longest a document is treated as fresh, and the TTL used when the
     * response carries no `Cache-Control: max-age`. A shorter `max-age` is
     * honored down to `minRefetchIntervalMs`. Default: 3600000 (1 hour).
     *
     * With refresh on an unknown `kid`, new keys arrive within the refetch
     * floor regardless of this value. What it bounds is how long a key the
     * signer has removed is still accepted.
     */
    maxTtlMs?: number

    /**
     * The refetch floor: a URL is not fetched again within this long of the
     * previous attempt, successful or not. Default: 60000 (1 minute).
     */
    minRefetchIntervalMs?: number

    /**
     * How long past its TTL a cached document may still be used when the
     * refetch fails. Default: 0 (an expired document is never used).
     */
    staleIfErrorMs?: number

    /**
     * How long past its TTL a cached document is returned immediately while
     * it is refetched in the background. Default: 0 (the refetch is awaited).
     */
    staleWhileRevalidateMs?: number

    /**
     * Receives the background refetch promise started under
     * `staleWhileRevalidateMs`. On a platform that ends work when the
     * response is sent (Cloudflare Workers), pass `ctx.waitUntil`.
     */
    waitUntil?: (work: Promise<unknown>) => void

    /** Refuse any URL that is not `https:`. Default: true. */
    requireHttps?: boolean

    /** Called after every outbound fetch. An exception it throws is ignored. */
    onFetch?: (event: KeyFetchEvent) => void
}

export interface KeyLookupOptions {
    /**
     * Require the metadata document to carry `issuer` equal to `id`
     * (issuer_missing / issuer_mismatch otherwise). Default: true.
     */
    requireIssuer?: boolean

    /**
     * Accept a JWKS embedded in the metadata document as `jwks` when it is
     * present, instead of following `jwks_uri`. Default: false.
     */
    allowInlineJwks?: boolean

    /**
     * Fetch again even though a fresh copy is cached, subject to the refetch
     * floor. `resolveKey` does this itself for an unknown `kid`.
     */
    refresh?: 'unknown_kid' | 'verify_failed'

    /** The `kid` being looked up, for `onFetch`. */
    kid?: string
}

export interface KeyQuery extends Omit<KeyLookupOptions, 'kid'> {
    /** The signer or issuer identifier (an HTTPS URL). */
    id: string
    /** The metadata document name under `/.well-known/`. */
    dwk: string
    kid: string
}

export interface KeyResolver {
    /**
     * The key `kid` from the JWKS of `id`. On an unknown `kid` the documents
     * are fetched again once, subject to the refetch floor, before failing
     * with `unknown_key`.
     */
    resolveKey(query: KeyQuery): Promise<JsonWebKey>

    /** The JWKS of `id`. */
    getJwks(
        id: string,
        dwk: string,
        options?: KeyLookupOptions,
    ): Promise<{ keys: JsonWebKey[] }>

    /** The metadata document at `{id}/.well-known/{dwk}`. */
    getMetadata(
        id: string,
        dwk: string,
        options?: KeyLookupOptions,
    ): Promise<Record<string, unknown>>
}

export const DEFAULT_KEY_FETCH_TIMEOUT_MS = 5_000
export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576
export const DEFAULT_MAX_TTL_MS = 3_600_000
export const DEFAULT_MIN_REFETCH_INTERVAL_MS = 60_000

/** The well-known metadata URL for a signer or issuer. */
export function metadataUrlFor(id: string, dwk: string): string {
    return `${id}/.well-known/${dwk}`
}

/**
 * `max-age` from a Cache-Control header, in ms. `no-store` and `no-cache`
 * read as 0. Undefined when the header says nothing about freshness.
 */
function maxAgeMs(cacheControl: string | null | undefined): number | undefined {
    if (!cacheControl) return undefined
    let result: number | undefined
    for (const part of cacheControl.split(',')) {
        const directive = part.trim().toLowerCase()
        if (directive === 'no-store' || directive === 'no-cache') return 0
        const match = /^max-age\s*=\s*"?(\d+)"?$/.exec(directive)
        if (match) result = Number(match[1]) * 1000
    }
    return result
}

/** Read a response body as text, refusing one larger than `limit` bytes. */
async function readBounded(response: Response, limit: number): Promise<string> {
    const declared = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(declared) && declared > limit) {
        throw new Error(`response exceeds ${limit} bytes`)
    }

    const reader = response.body?.getReader?.()
    if (!reader) {
        const text = await response.text()
        if (new TextEncoder().encode(text).byteLength > limit) {
            throw new Error(`response exceeds ${limit} bytes`)
        }
        return text
    }

    const decoder = new TextDecoder()
    let received = 0
    let text = ''
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > limit) {
            await reader.cancel().catch(() => {})
            throw new Error(`response exceeds ${limit} bytes`)
        }
        text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
}

interface LoadContext {
    doc: 'metadata' | 'jwks'
    id: string
    dwk: string
    kid?: string
}

function failureFrom(entry: KeyStoreEntry, url: string): Error {
    const message = entry.error ?? `Failed to fetch ${url}`
    return entry.errorCode
        ? new SignatureVerificationError(entry.errorCode, message)
        : new Error(message)
}

/**
 * Create a key resolver. One resolver holds one in-flight table, so share a
 * resolver across requests rather than creating one per request.
 */
export function createKeyResolver(
    options: KeyResolverOptions = {},
): KeyResolver {
    const store: KeyStore =
        options.store ?? new BoundedTtlCache<KeyStoreEntry>()
    const timeoutMs = options.timeoutMs ?? DEFAULT_KEY_FETCH_TIMEOUT_MS
    const maxResponseBytes =
        options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    const maxTtlMs = options.maxTtlMs ?? DEFAULT_MAX_TTL_MS
    const floorMs =
        options.minRefetchIntervalMs ?? DEFAULT_MIN_REFETCH_INTERVAL_MS
    const staleIfErrorMs = options.staleIfErrorMs ?? 0
    const staleWhileRevalidateMs = options.staleWhileRevalidateMs ?? 0
    const requireHttps = options.requireHttps ?? true
    const { onFetch, waitUntil } = options

    // Concurrent requests for one URL share one fetch.
    const inflight = new Map<string, Promise<unknown>>()

    const report = (event: KeyFetchEvent) => {
        if (!onFetch) return
        try {
            onFetch(event)
        } catch {
            // A logging hook must not fail a verification.
        }
    }

    /** One outbound fetch. Resolves to the parsed document and its TTL. */
    async function fetchDocument(
        url: string,
    ): Promise<{ body: unknown; ttlMs: number; status: number }> {
        let parsed: URL
        try {
            parsed = new URL(url)
        } catch {
            throw new Error(`Refusing to fetch ${url}: not a valid URL`)
        }
        if (requireHttps && parsed.protocol !== 'https:') {
            throw new Error(`Refusing to fetch ${url}: HTTPS is required`)
        }

        // Read at call time, so a fetch replaced after import is honored.
        const doFetch: KeyFetch =
            options.fetch ?? ((input, init) => globalThis.fetch(input, init))

        const response = await doFetch(url, {
            headers: { accept: 'application/json' },
            // Not 'error': Cloudflare Workers rejects it. With 'manual' the
            // redirect comes back as a 3xx (or, in browsers, an
            // 'opaqueredirect' with status 0) and is refused here.
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (
            response.type === 'opaqueredirect' ||
            (response.status >= 300 && response.status < 400)
        ) {
            const error = new Error(
                `Refusing redirect from ${url}: HTTP ${response.status}`,
            ) as Error & { status?: number }
            error.status = response.status
            throw error
        }
        if (!response.ok) {
            const error = new Error(
                `Failed to fetch ${url}: HTTP ${response.status}`,
            ) as Error & { status?: number }
            error.status = response.status
            throw error
        }

        let body: unknown
        if (
            !response.body &&
            typeof response.text !== 'function' &&
            typeof response.json === 'function'
        ) {
            // A fetch that returns a minimal response object (a test double,
            // or a wrapper that has already parsed the body) has no bytes
            // left to bound.
            body = await response.json()
        } else {
            const text = await readBounded(response, maxResponseBytes)
            try {
                body = JSON.parse(text)
            } catch {
                throw new Error(`Response from ${url} is not JSON`)
            }
        }
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            throw new Error(`Response from ${url} is not a JSON object`)
        }

        // max-age is a hint: honored down to the floor, capped at maxTtlMs.
        const hinted = maxAgeMs(response.headers?.get?.('cache-control'))
        const ttlMs = Math.max(floorMs, Math.min(maxTtlMs, hinted ?? maxTtlMs))
        return { body, ttlMs, status: response.status }
    }

    /**
     * Fetch `url` and write the outcome to the store. On failure a previously
     * cached body is kept and returned when it is still inside its stale
     * window; otherwise a failure entry is written and the error thrown.
     */
    function refetch(
        url: string,
        context: LoadContext,
        reason: KeyFetchReason,
        previous: KeyStoreEntry | undefined,
        validate?: (body: unknown) => void,
    ): Promise<unknown> {
        const running = inflight.get(url)
        if (running) return running

        const work = (async () => {
            const started = Date.now()
            const base = {
                url,
                doc: context.doc,
                id: context.id,
                dwk: context.dwk,
                ...(context.kid !== undefined ? { kid: context.kid } : {}),
                reason,
            }
            try {
                const { body, ttlMs, status } = await fetchDocument(url)
                // Validated before it is stored: a document that fails its
                // checks never becomes a cached body.
                validate?.(body)
                const now = Date.now()
                await store.set(
                    url,
                    {
                        body,
                        fetchedAt: now,
                        attemptedAt: now,
                        freshUntil: now + ttlMs,
                    },
                    ttlMs + Math.max(staleIfErrorMs, staleWhileRevalidateMs),
                )
                report({
                    ...base,
                    ok: true,
                    status,
                    duration_ms: now - started,
                    ttl_ms: ttlMs,
                })
                return body
            } catch (error) {
                const now = Date.now()
                const message =
                    (error as Error)?.name === 'TimeoutError'
                        ? `Timed out fetching ${url} after ${timeoutMs}ms`
                        : error instanceof Error
                          ? error.message
                          : String(error)
                const errorCode =
                    error instanceof SignatureVerificationError
                        ? error.code
                        : undefined
                const status = (error as { status?: number })?.status
                const usable =
                    previous !== undefined &&
                    previous.body !== null &&
                    now < previous.freshUntil + staleIfErrorMs

                if (usable) {
                    await store.set(
                        url,
                        {
                            ...previous,
                            attemptedAt: now,
                            error: message,
                            ...(errorCode ? { errorCode } : {}),
                        },
                        Math.max(
                            floorMs,
                            previous.freshUntil + staleIfErrorMs - now,
                        ),
                    )
                } else if (floorMs > 0) {
                    await store.set(
                        url,
                        {
                            body: null,
                            fetchedAt: 0,
                            attemptedAt: now,
                            freshUntil: 0,
                            error: message,
                            ...(errorCode ? { errorCode } : {}),
                        },
                        floorMs,
                    )
                }
                report({
                    ...base,
                    ok: false,
                    ...(status !== undefined ? { status } : {}),
                    duration_ms: now - started,
                    error:
                        (error as Error)?.name === 'TimeoutError'
                            ? 'timeout'
                            : message,
                    ...(usable ? { served_stale: true } : {}),
                })
                if (usable) return previous.body
                throw error instanceof SignatureVerificationError
                    ? error
                    : (error as Error)?.name === 'TimeoutError'
                      ? new Error(message)
                      : error
            } finally {
                inflight.delete(url)
            }
        })()

        inflight.set(url, work)
        return work
    }

    /** The document at `url`, from the store when policy allows. */
    async function load(
        url: string,
        context: LoadContext,
        force: KeyLookupOptions['refresh'],
        validate?: (body: unknown) => void,
    ): Promise<unknown> {
        const now = Date.now()
        const entry = await store.get(url)

        if (entry) {
            const hasBody = entry.body !== null
            const fresh = hasBody && now < entry.freshUntil
            if (fresh && !force) return entry.body

            // Inside the floor nothing is fetched, whatever the reason.
            if (now - entry.attemptedAt < floorMs) {
                if (
                    hasBody &&
                    (fresh || now < entry.freshUntil + staleIfErrorMs)
                ) {
                    return entry.body
                }
                throw failureFrom(entry, url)
            }

            if (
                hasBody &&
                !force &&
                now < entry.freshUntil + staleWhileRevalidateMs
            ) {
                const work = refetch(
                    url,
                    context,
                    'expired',
                    entry,
                    validate,
                ).catch(() => {})
                waitUntil?.(work)
                return entry.body
            }
        }

        const reason: KeyFetchReason =
            force ?? (entry && entry.body !== null ? 'expired' : 'cold')
        return refetch(url, context, reason, entry, validate)
    }

    async function getMetadata(
        id: string,
        dwk: string,
        lookup: KeyLookupOptions = {},
    ): Promise<Record<string, unknown>> {
        const url = metadataUrlFor(id, dwk)
        const requireIssuer = lookup.requireIssuer ?? true
        const validate = (body: unknown) => {
            if (!requireIssuer) return
            const issuer = (body as Record<string, unknown>).issuer
            // Bind the metadata document to the identity it was fetched
            // under. Without this, a document served at
            // {id}/.well-known/{dwk} -- via misconfigured shared hosting or
            // a subdomain takeover -- could point jwks_uri at keys that do
            // not belong to id. Same check as RFC 8414 Section 3.3.
            if (issuer === undefined) {
                throw issuerMissing(`Metadata document missing issuer: ${url}`)
            }
            // Byte equality as presented. No normalization.
            if (issuer !== id) {
                throw issuerMismatch(
                    `Metadata issuer "${String(issuer)}" does not match id "${id}"`,
                )
            }
        }
        const body = await load(
            url,
            { doc: 'metadata', id, dwk, kid: lookup.kid },
            lookup.refresh,
            validate,
        )
        // A stored body was validated when it was fetched, but possibly
        // under a lookup that did not require an issuer.
        validate(body)
        return body as Record<string, unknown>
    }

    async function locateJwks(
        id: string,
        dwk: string,
        lookup: KeyLookupOptions,
    ): Promise<{ jwks: { keys: JsonWebKey[] }; source: string }> {
        const metadataUrl = metadataUrlFor(id, dwk)
        const metadata = await getMetadata(id, dwk, lookup)

        const inline = metadata.jwks as { keys?: unknown } | undefined
        if (lookup.allowInlineJwks && inline && Array.isArray(inline.keys)) {
            return {
                jwks: inline as { keys: JsonWebKey[] },
                source: metadataUrl,
            }
        }

        const jwksUrl = metadata.jwks_uri
        if (typeof jwksUrl !== 'string' || !jwksUrl) {
            throw new Error(
                `Metadata document missing jwks_uri: ${metadataUrl}`,
            )
        }

        const jwks = await load(
            jwksUrl,
            { doc: 'jwks', id, dwk, kid: lookup.kid },
            lookup.refresh,
            (body) => {
                if (!Array.isArray((body as { keys?: unknown }).keys)) {
                    throw new Error(`Invalid JWKS format from ${jwksUrl}`)
                }
            },
        )
        return { jwks: jwks as { keys: JsonWebKey[] }, source: jwksUrl }
    }

    async function getJwks(
        id: string,
        dwk: string,
        lookup: KeyLookupOptions = {},
    ): Promise<{ keys: JsonWebKey[] }> {
        return (await locateJwks(id, dwk, lookup)).jwks
    }

    async function resolveKey(query: KeyQuery): Promise<JsonWebKey> {
        const { id, dwk, kid, ...rest } = query
        const lookup: KeyLookupOptions = { ...rest, kid }
        const find = (jwks: { keys: JsonWebKey[] }) =>
            jwks.keys.find(
                (key) => (key as { kid?: string } | null)?.kid === kid,
            )

        let located = await locateJwks(id, dwk, lookup)
        let key = find(located.jwks)

        // An unknown kid is how key rotation looks from here. Fetch again
        // once; the floor keeps a caller from turning this into a fetch per
        // request.
        if (!key && !lookup.refresh) {
            located = await locateJwks(id, dwk, {
                ...lookup,
                refresh: 'unknown_kid',
            })
            key = find(located.jwks)
        }

        if (!key) {
            throw new SignatureVerificationError(
                'unknown_key',
                `Key with kid="${kid}" not found in JWKS from ${located.source}`,
            )
        }
        return key
    }

    return { resolveKey, getJwks, getMetadata }
}

/**
 * Bounded TTL cache for remotely fetched documents.
 *
 * Entries are keyed by a URL taken from the request being verified, so an
 * unauthenticated signer controls how many distinct keys are created. Without
 * a size bound the map grows until the process runs out of memory.
 *
 * Eviction is least-recently-used. A Map iterates in insertion order, so
 * re-inserting an entry on read moves it to the end and the first key is
 * always the least recently used.
 */

export const DEFAULT_MAX_ENTRIES = 100

interface Entry<T> {
    value: T
    expiresAt: number
}

export class BoundedTtlCache<T> {
    private entries = new Map<string, Entry<T>>()
    private readonly maxEntries: number

    constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
        if (!Number.isInteger(maxEntries) || maxEntries < 1) {
            throw new Error('maxEntries must be a positive integer')
        }
        this.maxEntries = maxEntries
    }

    get size(): number {
        return this.entries.size
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key)
        if (!entry) {
            return undefined
        }

        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key)
            return undefined
        }

        // Refresh recency: deleting and re-inserting moves the key to the end.
        this.entries.delete(key)
        this.entries.set(key, entry)

        return entry.value
    }

    set(key: string, value: T, ttlMs: number): void {
        // Replacing an existing key must not count against the bound.
        this.entries.delete(key)

        if (this.entries.size >= this.maxEntries) {
            this.evictOne()
        }

        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs })
    }

    clear(): void {
        this.entries.clear()
    }

    /**
     * Drop an expired entry if there is one, otherwise the least recently
     * used. Preferring expired entries keeps live ones around longer without
     * changing the bound.
     */
    private evictOne(): void {
        const now = Date.now()

        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key)
                return
            }
        }

        const oldest = this.entries.keys().next()
        if (!oldest.done) {
            this.entries.delete(oldest.value)
        }
    }
}

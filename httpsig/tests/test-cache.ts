/**
 * Tests for the bounded TTL cache backing JWKS lookups
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { BoundedTtlCache, DEFAULT_MAX_ENTRIES } from '../src/utils/cache.js'

test('returns a stored value before it expires', () => {
    const cache = new BoundedTtlCache<string>()
    cache.set('a', 'value', 60_000)

    assert.strictEqual(cache.get('a'), 'value')
})

test('returns undefined for an unknown key', () => {
    const cache = new BoundedTtlCache<string>()

    assert.strictEqual(cache.get('missing'), undefined)
})

test('does not return a value once its TTL has elapsed', () => {
    const cache = new BoundedTtlCache<string>()
    cache.set('a', 'value', 0)

    assert.strictEqual(cache.get('a'), undefined)
    assert.strictEqual(cache.size, 0, 'expired entry should be dropped on read')
})

test('never exceeds maxEntries', () => {
    const cache = new BoundedTtlCache<number>(10)

    for (let i = 0; i < 1000; i++) {
        cache.set(`https://issuer-${i}.example/jwks`, i, 60_000)
        assert.ok(
            cache.size <= 10,
            `size ${cache.size} exceeded the bound at insert ${i}`,
        )
    }

    assert.strictEqual(cache.size, 10)
})

test('evicts the least recently used entry when full', () => {
    const cache = new BoundedTtlCache<string>(3)
    cache.set('a', 'A', 60_000)
    cache.set('b', 'B', 60_000)
    cache.set('c', 'C', 60_000)

    // Touch 'a' so 'b' becomes least recently used.
    assert.strictEqual(cache.get('a'), 'A')

    cache.set('d', 'D', 60_000)

    assert.strictEqual(cache.get('b'), undefined, 'b should have been evicted')
    assert.strictEqual(cache.get('a'), 'A')
    assert.strictEqual(cache.get('c'), 'C')
    assert.strictEqual(cache.get('d'), 'D')
})

test('evicts an expired entry in preference to a live one', () => {
    const cache = new BoundedTtlCache<string>(2)
    cache.set('stale', 'S', 0)
    cache.set('live', 'L', 60_000)

    cache.set('new', 'N', 60_000)

    assert.strictEqual(cache.get('stale'), undefined)
    assert.strictEqual(cache.get('live'), 'L', 'live entry should survive')
    assert.strictEqual(cache.get('new'), 'N')
})

test('replacing an existing key does not evict another entry', () => {
    const cache = new BoundedTtlCache<string>(2)
    cache.set('a', 'A', 60_000)
    cache.set('b', 'B', 60_000)

    cache.set('a', 'A2', 60_000)

    assert.strictEqual(cache.size, 2)
    assert.strictEqual(cache.get('a'), 'A2')
    assert.strictEqual(cache.get('b'), 'B')
})

test('clear empties the cache', () => {
    const cache = new BoundedTtlCache<string>()
    cache.set('a', 'A', 60_000)
    cache.clear()

    assert.strictEqual(cache.size, 0)
    assert.strictEqual(cache.get('a'), undefined)
})

test('rejects a non-positive bound', () => {
    assert.throws(() => new BoundedTtlCache<string>(0))
    assert.throws(() => new BoundedTtlCache<string>(-1))
    assert.throws(() => new BoundedTtlCache<string>(1.5))
})

test('has a sane default bound', () => {
    assert.ok(DEFAULT_MAX_ENTRIES > 0)

    const cache = new BoundedTtlCache<number>()
    for (let i = 0; i < DEFAULT_MAX_ENTRIES * 2; i++) {
        cache.set(`k${i}`, i, 60_000)
    }

    assert.strictEqual(cache.size, DEFAULT_MAX_ENTRIES)
})

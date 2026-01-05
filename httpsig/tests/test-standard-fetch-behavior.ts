/**
 * Test to understand standard fetch() content-type behavior
 */

import { test } from 'node:test'

test('Standard fetch: content-type with string body', async () => {
    // Create a Request object to inspect headers without making actual request
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: 'test string',
    })

    console.log('String body content-type:', req.headers.get('content-type'))
})

test('Standard fetch: content-type with JSON.stringify body', async () => {
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
    })

    console.log(
        'JSON.stringify body content-type:',
        req.headers.get('content-type'),
    )
})

test('Standard fetch: content-type with explicit header', async () => {
    const req = new Request('https://example.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
    })

    console.log(
        'Explicit header content-type:',
        req.headers.get('content-type'),
    )
})

test('Standard fetch: content-type with GET (no body)', async () => {
    const req = new Request('https://example.com/api', {
        method: 'GET',
    })

    console.log('GET content-type:', req.headers.get('content-type'))
})

test('Standard fetch: content-type with null body', async () => {
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: null,
    })

    console.log('null body content-type:', req.headers.get('content-type'))
})

test('Standard fetch: content-type with Blob', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: blob,
    })

    console.log('Blob body content-type:', req.headers.get('content-type'))
})

test('Standard fetch: content-type with URLSearchParams', async () => {
    const params = new URLSearchParams({ foo: 'bar' })
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: params,
    })

    console.log(
        'URLSearchParams body content-type:',
        req.headers.get('content-type'),
    )
})

test('Standard fetch: content-type with FormData', async () => {
    const formData = new FormData()
    formData.append('foo', 'bar')
    const req = new Request('https://example.com/api', {
        method: 'POST',
        body: formData,
    })

    const contentType = req.headers.get('content-type')
    console.log('FormData body content-type:', contentType)
    console.log('  (FormData includes boundary parameter)')
})

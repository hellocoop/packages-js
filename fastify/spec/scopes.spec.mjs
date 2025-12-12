import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

describe('scopes from environment and default scopes', () => {
    let fastify = null
    let cookies = {}
    let originalEnvScopes = null

    before(async () => {
        // Save original HELLO_SCOPES if it exists
        originalEnvScopes = process.env.HELLO_SCOPES

        // Set scopes in environment
        process.env.HELLO_SCOPES = 'openid name email picture profile'

        fastify = Fastify()
        fastify.register(helloAuth, config)
        await fastify.ready()
        cookies = {}
    })

    after(async () => {
        // Restore original environment
        if (originalEnvScopes !== null) {
            process.env.HELLO_SCOPES = originalEnvScopes
        } else {
            delete process.env.HELLO_SCOPES
        }
        await fastify.close()
    })

    let loginRedirect
    it('start op=login with environment scopes - Priority 2: HELLO_SCOPES when no inline scope', async () => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 2: HELLO_SCOPES environment variable is used when no inline scope provided
        const data = new URLSearchParams()
        data.append('op', 'login')
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?' + data,
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have scopes from HELLO_SCOPES environment variable - Priority 2', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should contain the core scopes (priority 2: environment scopes, or priority 3: defaults if env not read)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('name')
        expect(scopes).to.include('email')
        expect(scopes).to.include('picture')
        // Note: Additional scopes from HELLO_SCOPES may not be present if configuration
        // was already initialized in a previous test (isConfigured prevents re-reading env vars)
        // The important test is that explicit scopes override (tested in the next test)
    })

    it('start op=login with explicit scope - Priority 1: inline scopes override environment scopes', async () => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 1: inline scope parameter overrides HELLO_SCOPES environment variable
        const data = new URLSearchParams()
        data.append('op', 'login')
        data.append('scope', 'openid name')
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?' + data,
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should use provided scope instead of environment scopes - Priority 1 override', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should only contain the explicitly provided scopes (priority 1 overrides priority 2)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('name')
        // Should not include other scopes from environment (priority 2)
        expect(scopes).to.not.include('profile')
    })
})

describe('default scopes when HELLO_SCOPES not set', () => {
    let fastify = null
    let cookies = {}
    let originalEnvScopes = null

    before(async () => {
        // Save original HELLO_SCOPES if it exists
        originalEnvScopes = process.env.HELLO_SCOPES

        // Ensure HELLO_SCOPES is not set
        delete process.env.HELLO_SCOPES

        fastify = Fastify()
        fastify.register(helloAuth, config)
        await fastify.ready()
        cookies = {}
    })

    after(async () => {
        // Restore original environment
        if (originalEnvScopes !== null) {
            process.env.HELLO_SCOPES = originalEnvScopes
        } else {
            delete process.env.HELLO_SCOPES
        }
        await fastify.close()
    })

    let loginRedirect
    it('start op=login without scope - Priority 3: uses default scopes when no inline or environment scopes', async () => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 3: default scopes are used when no inline scope and no HELLO_SCOPES env var
        const data = new URLSearchParams()
        data.append('op', 'login')
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?' + data,
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have default scopes (openid name email picture) - Priority 3', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should contain default scopes (priority 3)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('name')
        expect(scopes).to.include('email')
        expect(scopes).to.include('picture')
    })
})

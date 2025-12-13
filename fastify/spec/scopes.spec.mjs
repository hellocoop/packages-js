import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import { resetConfiguration } from '@hellocoop/api'
import * as utils from './utils.mjs'

describe('scopes from environment and default scopes', () => {
    let fastify = null
    let cookies = {}
    let originalEnvScopes = null
    const config = {
        client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
    }

    before(async () => {
        // Reset configuration to ensure fresh state
        resetConfiguration()
        fastify = Fastify()
        process.env.HELLO_SCOPES = 'openid family_name email'
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
    it('start op=login with environment scopes', async () => {
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

    it('authz request should have scopes from HELLO_SCOPES environment variable', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should contain the core scopes (priority 2: environment scopes, or priority 3: defaults if env not read)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('family_name')
        expect(scopes).to.include('email')
        expect(scopes).to.not.include('picture')
        expect(scopes).to.not.include('name')
        expect(scopes.length).to.eql(3)
    })

    it('start op=login with explicit scope', async () => {
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

    it('authz request should use provided scope', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should only contain the explicitly provided scopes (priority 1 overrides priority 2)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('name')
        expect(scopes.length).to.eql(2)
        // Should not include other scopes from environment (priority 2)
        expect(scopes).to.not.include('profile')
    })
})

describe('scopes from config overriding default scopes', () => {
    let fastify = null
    let cookies = {}
    let originalEnvScopes = null
    const config = {
        client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
        // here we are overriding default scopes
        scope: ['openid', 'given_name', 'email'],
    }

    before(async () => {
        // Reset configuration to ensure fresh state
        resetConfiguration()
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
    it('start op=login with no scopes ', async () => {
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

    it('authz request should have config scopes', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should contain the core scopes (priority 2: environment scopes, or priority 3: defaults if env not read)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('given_name')
        expect(scopes).to.include('email')
        expect(scopes).to.not.include('picture')
        expect(scopes).to.not.include('name')
        expect(scopes.length).to.eql(3)
    })
})

describe('default scopes when HELLO_SCOPES not set', () => {
    let fastify = null
    let cookies = {}
    let originalEnvScopes = null
    const config = {
        client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
    }

    before(async () => {
        // Reset configuration to ensure fresh state
        resetConfiguration()
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
    it('start op=login without scope', async () => {
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

    it('authz request should have default scopes (openid name email picture)', async () => {
        const loginRedirectUrl = new URL(loginRedirect)
        const scope = loginRedirectUrl.searchParams.get('scope')
        expect(scope).to.exist
        const scopes = scope.split(' ')
        // Should contain default scopes (priority 3)
        expect(scopes).to.include('openid')
        expect(scopes).to.include('name')
        expect(scopes).to.include('email')
        expect(scopes).to.include('picture')
        expect(scopes.length).to.eql(4)
    })
})

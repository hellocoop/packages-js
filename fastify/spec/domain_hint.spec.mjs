import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const domainHint = 'example.org'

describe('domain_hint', () => {
    let fastify = null
    let cookies = {}

    before(async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    let loginRedirect
    it('start op=login with domain_hint param', async () => {
        const data = new URLSearchParams()
        data.append('op', 'login')
        data.append('domain_hint', domainHint)
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

    it('authz request should have domain_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })

    it('authz request should have domain_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })

    it('IdP initiated login w/ GET domain_hint ', async () => {
        const data = new URLSearchParams()
        data.append('domain_hint', domainHint)
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?' + data.toString(),
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have domain_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })

    it('IdP initiated login w/ POST domain_hint ', async () => {
        const data = new URLSearchParams()
        data.append('domain_hint', domainHint)
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/hellocoop',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: data.toString(),
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have domain_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })

    it('IdP initiated login w/ GET domain_hint & iss', async () => {
        const data = new URLSearchParams()
        data.append('domain_hint', domainHint)
        data.append('iss', 'https://issuer.hello.coop')
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?' + data.toString(),
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have domain_hint param & iss', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })

    it('IdP initiated login w/ POST domain_hint ', async () => {
        const data = new URLSearchParams()
        data.append('domain_hint', domainHint)
        data.append('iss', 'https://issuer.hello.coop')
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/hellocoop',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: data.toString(),
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have domain_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('domain_hint')).to.eql(domainHint)
    })
})

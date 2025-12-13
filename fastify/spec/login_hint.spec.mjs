import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import { resetConfiguration } from '@hellocoop/api'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const loginHint = 'dan.brown@example.net'

describe('login_hint', () => {
    let fastify = null
    let cookies = {}

    before(async () => {
        resetConfiguration()
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    let loginRedirect
    it('start op=login with login_hint param', async () => {
        const data = new URLSearchParams()
        data.append('op', 'login')
        data.append('login_hint', loginHint)
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })

    it('IdP initiated login w/ GET login_hint ', async () => {
        const data = new URLSearchParams()
        data.append('login_hint', loginHint)
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })

    it('IdP initiated login w/ POST login_hint ', async () => {
        const data = new URLSearchParams()
        data.append('login_hint', loginHint)
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })

    it('IdP initiated login w/ GET login_hint & iss', async () => {
        const data = new URLSearchParams()
        data.append('login_hint', loginHint)
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })

    it('IdP initiated login w/ POST login_hint & iss', async () => {
        const data = new URLSearchParams()
        data.append('login_hint', loginHint)
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })

    it('IdP initiated login w/ GET login_hint & domain_hint', async () => {
        const data = new URLSearchParams()
        data.append('login_hint', loginHint)
        data.append('domain_hint', 'me.com')
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

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(
            loginRedirect.split('?')[1],
        )
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
        const domainHint = loginRedirectParams.get('domain_hint')
        expect(domainHint).to.not.exist
    })
})

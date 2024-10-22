import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const loginHint = 'johnsmith@me.com'

describe('login_hint', () => {
    let fastify = null
    let cookies = {}

    before( async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    let loginRedirect;
    it('start op=login with login_hint param', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=login&login_hint=' + loginHint,
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    it('authz request should have login_hint param', async () => {
        const loginRedirectParams = new URLSearchParams(loginRedirect.split('?')[1])
        expect(loginRedirectParams.get('login_hint')).to.eql(loginHint)
    })
})
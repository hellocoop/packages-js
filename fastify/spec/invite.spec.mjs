import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const loggedOut = {
    isLoggedIn: false,
}
const loggedIn = {
    isLoggedIn: true,
    sub: '00000000-0000-0000-0000-00000000',
    name: 'John Smith',
    iat: 123,
    email: 'john.smith@example.com',
    picture: 'https://pictures.hello.coop/mock/portrait-of-john-smith.jpeg',
    email_verified: true,
}

const appName = 'Test'

describe('login', () => {
    let fastify = null
    let cookies = {}

    before(async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    it('should be logged out', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=auth',
            cookies,
        })
        utils.harvestCookies(cookies, response)
        expect(response.statusCode).to.eql(200)
        const json = JSON.parse(response.body)
        expect(json).to.exist
        expect(json).to.eql(loggedOut)
    })

    let loginRedirect
    it('start op=login', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=login',
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.eql(302)
        expect(response.headers).to.exist
        expect(response.headers.location).to.exist
        loginRedirect = response.headers.location
    })

    let loginResponseParameters
    it('log in to mockin', async () => {
        try {
            const response = await fetch(loginRedirect + '&mock=clayton', {
                redirect: 'manual',
            })
            const location = response.headers.get('location')
            const redirectURL = new URL(location)
            loginResponseParameters = Object.fromEntries(
                redirectURL.searchParams.entries(),
            )
        } catch (e) {
            console.error('Error fetching loginRedirect', e)
            return { error: e }
        }
        expect(loginResponseParameters).to.exist
    })

    it('complete login', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url:
                '/api/hellocoop?' +
                new URLSearchParams(loginResponseParameters).toString(),
            cookies,
        })
        utils.harvestCookies(cookies, response)

        expect(response.statusCode).to.equal(302)
        expect(response.headers).to.exist
        expect(response.cookies).to.exist
        const resCookies = response.cookies
        expect(resCookies[0].name).to.eql('hellocoop_oidc')
        expect(resCookies[1].name).to.eql('hellocoop_auth')
    })

    it('get back logged in user', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=auth',
            cookies,
        })
        utils.harvestCookies(cookies, response)
        expect(response.statusCode).to.eql(200)
        const json = JSON.parse(response.body)
        expect(json).to.exist
        json.iat = 123 //reset
        expect(json).to.eql(loggedIn)
    })

    let inviteRedirect
    it('start op=invite', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=invite&app_name=' + appName,
            cookies,
        })
        utils.harvestCookies(cookies, response)
        expect(response.statusCode).to.eql(302)
        expect(response.headers.location).to.exist
        inviteRedirect = response.headers.location
    })

    it('invite request has correct params', async () => {
        const inviteReqUrl = new URL(inviteRedirect)
        const inviteReqUrlParams = new URLSearchParams(inviteReqUrl.search)
        const app_name = inviteReqUrlParams.get('app_name')
        const prompt = inviteReqUrlParams.get('prompt')
        expect(prompt).to.eql(
            `${loggedIn.name} has invited you to join ${appName}`,
        )
        expect(app_name).to.eql(appName)
        const inviter = inviteReqUrlParams.get('inviter')
        expect(inviter).to.eql(loggedIn.sub)
        const client_id = inviteReqUrlParams.get('client_id')
        expect(client_id).to.eql(config.client_id)
        //tbd - other assertions
    })
})

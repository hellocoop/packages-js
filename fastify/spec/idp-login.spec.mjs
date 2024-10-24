import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const loginHint = 'johnsmith@me.com'

describe('provider initiated login', () => {
    let fastify = null
    let cookies = {}

    before( async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    it('redirect with correct params', async () => {
        const issParam = 'https://issuer.hello.coop'
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?iss=' + issParam,
            cookies,
        })

        expect(response.statusCode).to.eql(302)
        const authzReqUrl = new URL(response.headers.location) 
        const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
        const client_id = authzReqUrlParams.get('client_id')
        expect(client_id).to.eql(config.client_id)
        const scope = authzReqUrlParams.get('scope')
        expect(scope).to.exist
        const response_type = authzReqUrlParams.get('response_type')
        expect(response_type).to.exist
        const response_mode = authzReqUrlParams.get('response_mode')
        expect(response_mode).to.exist
        const nonce = authzReqUrlParams.get('nonce')
        expect(nonce).to.exist
        const code_challenge = authzReqUrlParams.get('code_challenge')
        expect(code_challenge).to.exist
        const code_challenge_method = authzReqUrlParams.get('code_challenge_method')
        expect(code_challenge_method).to.exist
        //tbd - other assertions
    })
})
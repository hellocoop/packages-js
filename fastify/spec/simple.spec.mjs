import { expect } from 'chai'

import Fastify from 'fastify'

import { helloAuth } from '@hellocoop/fastify' // import from root node_modules 


Add utils module to packages-js 

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

describe('Simple proof of concept API test', () => {
    let fastify = null
    let cookies = {}

    before( async () => {
        fastify = await Fastify().ready()
        fastify.register(helloAuth, config)
        cookies = {}
    })

    it('get logged out state', async () => {
  
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/hellocoop?op=auth',
            cookies,
        })
        utils.harvestCookies(cookies, response)
        
        expect(response.statusCode).to.equal(200)
        const json = JSON.parse(response.body)
        expect(json).to.exist

        console.log({json})

    })
})


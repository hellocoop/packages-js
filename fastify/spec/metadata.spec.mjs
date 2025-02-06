import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const fetchToken = async () => {
    const results = await fetch(
        'http://mockin:3333/command/mock?client_id=' + config.client_id,
    )
    if (!results.ok) throw new Error('Failed to fetch command token')
    const json = await results.json()
    return json.command_token
}

describe('metadata command', () => {
    let fastify = null
    let cookies = {}
    let command_token = null

    before(async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
        command_token = await fetchToken()
    })

    it('should get metadata', async () => {
        const data = new URLSearchParams()
        data.append('command_token', command_token)
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
        expect(response.statusCode).to.eql(200)
        const json = JSON.parse(response.body)
        expect(json).to.exist

        // console.log('metadata', json)

        expect(json.context).to.exist
        // expect(json.context.package_name).to.eql()
        expect(json.context.package_version).to.exist
        // expect(json.context.package_version).to.eql('0.0.1')
        expect(json.context.iss).to.exist
        expect(json.commands_uri).to.exist
        expect(json.commands_supported).to.exist
        expect(json.commands_supported).to.eql(['metadata'])
        expect(json.commands_ttl).to.exist
        expect(json.commands_ttl).to.eql(0)
        expect(json.client_id).to.exist
        expect(json.client_id).to.eql(config.client_id)
    })
})

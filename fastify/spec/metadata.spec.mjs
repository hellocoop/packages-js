import { expect } from 'chai'
import Fastify from 'fastify'
import { helloAuth } from '@hellocoop/fastify'
import * as utils from './utils.mjs'

const config = {
    client_id: '8c3a40a9-b235-4029-8d16-c70592ca94bb',
}

const appName = 'Test'

const command_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ5b3VyLWFwcCIsInN1YiI6IjEyMzQ1Njc4OTAiLCJhdWQiOiJ5b3VyLWF1ZGllbmNlIiwiZXhwIjoxNjgzMDg4ODAwLCJpYXQiOjE2ODMwODUyMDAsImNvbW1hbmQiOiJtZXRhZGF0YSJ9.Pv1nvWmVpUcs54JkUj9W7HtXQ9Ieqwhr5q_GgFMeIvs'

describe('metadata command', () => {
    let fastify = null
    let cookies = {}

    before( async () => {
        fastify = Fastify()
        fastify.register(helloAuth, config)
        await Fastify().ready()
        cookies = {}
    })

    it('should get metadata', async () => {
        const data = new URLSearchParams();
        data.append('command_token', command_token)
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/hellocoop',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
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
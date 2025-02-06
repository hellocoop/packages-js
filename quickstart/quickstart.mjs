#!/usr/bin/env node

import semver from 'semver'
import nextConfig from './next.mjs'
import expressConfig from './express.mjs'
import fastifyConfig from './fastify.mjs'

const requiredVersion = '>=18.3.0'

if (!semver.satisfies(process.versions.node, requiredVersion)) {
    console.error(`This script requires Node.js version ${requiredVersion}`)
    process.exit(1)
}

// following are in Nodejs 18+
import { parseArgs } from 'node:util'

if (!process.stdout.isTTY) {
    const error = new Error(
        'Not running on interactive terminal. Exiting Hellō Quickstart.',
    )
    console.error(error)
    process.exit(1)
}

let {
    values: {
        nextjs,
        express,
        fastify,
        provider_hint,
        suffix,
        wildcard_domain,
        integration,
    },
} = parseArgs({
    options: {
        nextjs: {
            type: 'boolean',
        },
        express: {
            type: 'boolean',
        },
        fastify: {
            type: 'boolean',
        },
        provider_hint: {
            type: 'string',
            short: 'p',
        },
        suffix: {
            type: 'string',
            short: 'x',
        },
        integration: {
            type: 'string',
            short: 'i',
        },
        wildcard_domain: {
            type: 'boolean',
            short: 'w',
        },
    },
})

import quickstart from './index.js'
import dotenv from 'dotenv'

const options = {}
if (provider_hint) options.provider_hint = provider_hint
if (suffix) options.suffix = suffix
if (integration) options.integration = integration
if (wildcard_domain) options.wildcard_domain = wildcard_domain
;(async () => {
    if (nextjs) {
        await nextConfig(options)
        process.exit(0)
    }

    if (express) {
        await expressConfig(options)
        process.exit(0)
    }

    if (fastify) {
        await fastifyConfig(options)
        process.exit(0)
    }

    // direct invocation

    dotenv.config() // .env

    const client_id = await quickstart(options)
    console.log(`client_id=${client_id}`)
})()

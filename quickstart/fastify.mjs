// fastify.mjs

import express from './express.mjs'

const defaultOptions = {
    integration: 'quickstart-fastify',
    suffix: ' Fastify App',
}

const fastify = async (options) => {
    await express({ ...defaultOptions, ...options }, 'fastify')
}

export default fastify

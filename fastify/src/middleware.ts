import { FastifyRequest, FastifyReply } from 'fastify'
import { Auth } from '@hellocoop/definitions'
import { configuration } from '@hellocoop/api'

declare module 'fastify' {
    interface FastifyRequest {
        getAuth: () => Promise<Auth>
    }
}

export const redirect = (target: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const auth: Auth = await request.getAuth()
        if (auth.isLoggedIn) {
            return // equivalent to Express' next()
        } else {
            return reply.redirect(target)
        }
    }
}

export const unauthorized = async (
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    const auth: Auth = await request.getAuth()
    if (!auth.isLoggedIn) {
        reply
            .header('WWW-Authenticate', `Hello ${configuration.clientId}`)
            .status(401)
        return reply.send()
    }
}

export const setAuth = async (request: FastifyRequest) => {
    await request.getAuth()
}

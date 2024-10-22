// use Express for type information

import { 
    FastifyPluginAsync,
 } from 'fastify'
import fp from 'fastify-plugin'

import { 
    FastifyRequest,
    FastifyReply,
    FastifyPluginOptions
} from 'fastify'

import { serialize } from 'cookie'

import { Auth } from '@hellocoop/types'
import { 
    router,
    HelloResponse, 
    HelloRequest, 
    clearAuthCookieParams,
    getAuthfromCookies, 
    isConfigured,
    configure,
    configuration,
    Config,
}  from '@hellocoop/api'

const convertToHelloRequest = ( req: FastifyRequest, res: FastifyReply ): HelloRequest => {
    return {
        headers: () => { return req.headers as { [key: string]: string }},
        query: req.query as { [key: string]: string } | {},
        path: req?.routeOptions?.url || '',
        getAuth: () => { return req.auth },
        setAuth: (auth: Auth) => {req.auth = auth},
        method: req.method,
        body: req.body,
        frameWork: 'fastify',
        loginSyncWrapper: (loginSync, params) => { 
            return loginSync({...params, req, res}) 
        },
        logoutSyncWrapper: (logoutSync) => { 
            return logoutSync({req, res}) 
        },

    }
}


const convertToHelloResponse = ( res: FastifyReply ): HelloResponse => {
    return {
        clearAuth: () => {
            const { name, value, options } = clearAuthCookieParams()
            res.header('Set-Cookie', serialize(name, value, options))
        },
        send: (data: any) => res.type('text/html').send( data ),
        json: (data: any) => res.send( data),
        redirect: (url : string) => res.redirect(url),
        setCookie: (name: string, value: string, options: any) => {
            res.header('Set-Cookie', serialize(name, value, options))
        },
        getHeaders: () => { return res.getHeaders() as Record<string, string>},
        setHeader: (name: string, value: string | string[]) => res.header(name, value),
        status: ( statusCode: number) => { 
            res.code(statusCode) 
            return {
                send: (data: any) => res.send(data)
            }
        },
    }
}



declare module 'fastify' {
    interface FastifyRequest {
      auth?: Auth,
      getAuth: () => Promise<Auth>
    }
    interface FastifyReply {
      clearAuth: () => void,
    }
  }
  
export interface HelloConfig extends FastifyPluginOptions, Config {}
  
  
const helloPlugin: FastifyPluginAsync <HelloConfig> = async (instance, options) => {
    if (!isConfigured)
       configure(options)
    instance.decorateRequest('auth', undefined)
    instance.decorateRequest('getAuth', async function () { 
        const dummyResponse: FastifyReply = {} as FastifyReply
        const helloReq = convertToHelloRequest(this, dummyResponse)
        this.auth = await getAuthfromCookies(helloReq)
        return this.auth  
     })
    instance.decorateReply('clearAuth', function () {
        const { name, value, options } = clearAuthCookieParams()
        this.header('Set-Cookie', serialize(name, value, options))
    })

    instance.get(configuration.apiRoute, async (req, res) => {
      const helloReq = convertToHelloRequest(req, res)
      const helloRes = convertToHelloResponse(res)
      return await router(helloReq, helloRes)
    })
    instance.post(configuration.apiRoute, async (req, res) => {
        const helloReq = convertToHelloRequest(req, res)
        const helloRes = convertToHelloResponse(res)
        return await router(helloReq, helloRes)
      })
  }

export const auth = fp( helloPlugin )
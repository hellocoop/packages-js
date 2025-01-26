import { Router, Request, Response, NextFunction, text } from 'express'
import { serialize } from 'cookie'
import { Auth, Claims } from '@hellocoop/definitions'
import { 
    router,
    HelloResponse, 
    HelloRequest,
    LoginSyncResponse, 
    LogoutSyncResponse,
    clearAuthCookieParams,
    getAuthfromCookies, 
    isConfigured,
    configure,
    Config,
    configuration,
    PackageMetadata,
} from '@hellocoop/api'

// set name and version to provide in metadata
import parentPackageJson from '../package.json'
const { name, version } = parentPackageJson;
PackageMetadata.setMetadata(name, version);

type ExpressLoginParams = {
    token: string,
    payload: Claims,
    target_uri: string,
    req: Request,
    res: Response
}

type ExpressLogoutParams = {
    req: Request,
    res: Response
}

type ExpressLoginSync = (params: ExpressLoginParams) => Promise<LoginSyncResponse>
type ExpressLogoutSync = (params: ExpressLogoutParams) => Promise<LogoutSyncResponse>

export type HelloConfig = Omit<Config, 'loginSync' | 'logoutSync'> & {
    loginSync: ExpressLoginSync;
    logoutSync: ExpressLogoutSync;
};

const convertToHelloRequest = (req: Request, res: Response): HelloRequest => {
    return {
        headers: () => req.headers as { [key: string]: string },
        query: req.query as { [key: string]: string } | {},
        path: req.path,
        getAuth: () => req.auth,
        setAuth: (auth: Auth) => { req.auth = auth },
        method: req.method,
        body: req.body,
        frameWork: 'express',
        loginSyncWrapper: (loginSync, params) => { 
            return loginSync({...params, req, res}) 
        },
        logoutSyncWrapper: (logoutSync) => { 
            return logoutSync({req, res}) 
        },
    }
}

const convertToHelloResponse = (res: Response): HelloResponse => {
    return {
        clearAuth: () => {
            const { name, value, options } = clearAuthCookieParams()
            res.setHeader('Set-Cookie', serialize(name, value, options))
        },
        send: (data: any) => res.type('text/html').send(data),
        json: (data: any) => res.json(data),
        redirect: (url: string) => res.redirect(url),
        setCookie: (name: string, value: string, options: any) => {
            res.setHeader('Set-Cookie', serialize(name, value, options))
        },
        setHeader: (name: string, value: string | string[]) => {
            if (Array.isArray(value)) {
                if (name.toLowerCase() === 'set-cookie') {
                    value.forEach(val => res.setHeader(name, val)); // Append each cookie individually
                } else {
                    res.setHeader(name, value.join(', ')); // Combine array values into a single string separated by commas
                }
            } else {
                res.setHeader(name, value);
            }
        },    
        getHeaders: () => { throw( new Error('getHeaders not implemented')) }, // not implemented    
        status: (statusCode: number) => { 
            res.status(statusCode)
            return {
                send: (data: any) => res.send(data)
            }
        },
    }
}


declare global {
    namespace Express {
      interface Request {
        auth?: Auth;
        getAuth(): Promise<Auth>;
      }
      interface Response {
        clearAuth(): void;
      }
    }
  }

// // Express middleware for auth
// app.use( async (req: Request, res: Response, next: NextFunction) => {
//     const helloReq = convertToHelloRequest(req)
//     req.auth = await getAuthfromCookies(helloReq)
//     next()
// })

// // Express route
// app.get('/api/hellocoop', async (req: Request, res: Response) => {
//     const helloReq = convertToHelloRequest(req)
//     const helloRes = convertToHelloResponse(res)
//     return await router(helloReq, helloRes)
// })

// Configure plugin options if needed


export const auth = function ( config: Config): Router {
    if (!isConfigured) {
        configure(config as Config)
    }

console.log({isConfigured,configuration})

    const r = Router()
    r.use(async (req: Request, res: Response, next: NextFunction) => {
        const helloReq = convertToHelloRequest(req,res)
        req.getAuth = async () => { 
            req.auth = await getAuthfromCookies(helloReq) 
            return req.auth
        }
        res.clearAuth = () => {
            const { name, value, options } = clearAuthCookieParams()
            res.setHeader('Set-Cookie', serialize(name, value, options))
        }
        next()
    })
    
    r.post(configuration.apiRoute, text(), async (req: Request, res: Response ) => {
        const helloReq = convertToHelloRequest(req,res)
        const helloRes = convertToHelloResponse(res)
        await router(helloReq, helloRes)   
    })

    r.get(configuration.apiRoute, text(), async (req: Request, res: Response ) => {
        const helloReq = convertToHelloRequest(req,res)
        const helloRes = convertToHelloResponse(res)
        await router(helloReq, helloRes)   
    })
    return r
}


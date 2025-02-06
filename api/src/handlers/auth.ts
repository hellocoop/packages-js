import { HelloRequest, HelloResponse } from '../types'

import {
    getAuthfromCookies,
    saveAuthCookie,
    clearAuthCookie,
} from '../lib/auth'

import { Auth, Claims } from '@hellocoop/definitions'
// import { decryptObj } from '@hellocoop/helper-server'
// import config from '../lib//config'

// export type AuthHelloRequest = HelloRequest & {
//     auth?: Auth
// }

export type AuthUpdates = Claims & {
    [key: string]: any // Allow arbitrary optional properties
}

export const handleAuth = async function (
    req: HelloRequest,
    res: HelloResponse,
) {
    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
    )
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.json(await getAuthfromCookies(req, res))
}

export const clearAuth = async function (res: HelloResponse) {
    clearAuthCookie(res)
}

export const updateAuth = async function (
    req: HelloRequest,
    res: HelloResponse,
    authUpdates: AuthUpdates,
): Promise<Auth | null> {
    const auth = await getAuthfromCookies(req, res)
    if (!auth.isLoggedIn) return auth
    const newAuth = {
        ...auth,
        ...authUpdates,
        sub: auth.sub,
        iat: auth.iat,
    }
    const success = await saveAuthCookie(res, newAuth)
    if (success) return newAuth
    return null
}

// export const handleCookieTokenVerify = async function ( req: HelloRequest, res: HelloResponse) {
//     const cookieToken = req.body
//     if (!cookieToken)
//         return res.status(400).send('Invalid request')
//     try {
//         const auth = await decryptObj( cookieToken, config.secret as string) as Auth | undefined
//         if (auth) {
//             return res.json(auth)
//         }
//     } catch( e ) {
//         console.error(e)
//     }
//     return res.status(401).send('Unauthorized')
// }

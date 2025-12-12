import config from './config'
import { HelloRequest, HelloResponse } from '../types'
import { parse } from 'cookie'
import { decryptObj, encryptObj } from '@hellocoop/helper-server'

const {
    cookies: { oidcName },
} = config

export type OIDC = {
    code_verifier: string
    nonce: string
    redirect_uri: string
    target_uri: string
}

export const getOidc = async (
    req: HelloRequest,
    res: HelloResponse,
): Promise<OIDC | undefined> => {
    try {
        const cookies = parse(req.headers()?.cookie || '')
        const oidcCookie = cookies[oidcName]
        if (!oidcCookie) return undefined
        const oidc = (await decryptObj(oidcCookie, config.secret as string)) as
            | OIDC
            | undefined
        if (oidc) {
            return oidc
        }
    } catch (e) {
        clearOidcCookie(res)
        console.error(e)
    }
    return undefined
}

let apiRoute: string = '/'

export const saveOidc = async (
    req: HelloRequest,
    res: HelloResponse,
    oidc: OIDC,
) => {
    if (apiRoute === '/') apiRoute = req.path
    try {
        const encCookie = await encryptObj(oidc, config.secret as string)
        res.setCookie(oidcName, encCookie, {
            httpOnly: true,
            secure: config.production,
            sameSite: config.sameSiteStrict ? 'strict' : 'lax',
            maxAge: 5 * 60, // 5 minutes
            path: apiRoute,
        })
    } catch (e) {
        console.error(e)
    }
}

export const clearOidcCookie = (res: HelloResponse) => {
    res.setCookie(oidcName, '', {
        expires: new Date(0), // Set the expiry date to a date in the past
        path: apiRoute,
    })
}

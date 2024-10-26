import { decryptObj, encryptObj } from '@hellocoop/helper-server'
import { Auth, NotLoggedIn } from '@hellocoop/definitions'

import { HelloRequest, HelloResponse } from '../types'

import config from './config'

import { parse, SerializeOptions } from 'cookie'
import { clearOidcCookie } from './oidc'

const { cookies: {authName, oidcName} } = config 

const PRODUCTION = config.production
const ENABLE_3P_COOKIES = (process.env.ENABLE_3P_COOKIES === 'true')
const SAME_SITE = (ENABLE_3P_COOKIES) 
    ? 'none' 
    : (config.sameSiteStrict ? 'strict' : 'lax')
const SECURE = PRODUCTION || ENABLE_3P_COOKIES


export const saveAuthCookie = async ( res: HelloResponse, auth: Auth): Promise<boolean> =>  {
    try {
        const encCookie = await encryptObj(auth, config.secret as string)
        if (!encCookie)
            return false
        res.setCookie(authName, encCookie, {
            httpOnly: true,
            secure: SECURE,
            sameSite: SAME_SITE,
            path: '/' // let any server side route call getAuth
        })  
        return true    
    } catch (e) {
        console.error(e)
    }
    return false
}

export const clearAuthCookie = ( res: HelloResponse) =>  {
    const { name, value, options } = clearAuthCookieParams()
    res.setCookie( name, value, options )
}

export const clearAuthCookieParams = (): { name: string, value: string, options: SerializeOptions } => {
    return {
        name: authName, 
        value: '', 
        options: {
            expires: new Date(0), // Set the expiry date to a date in the past
            path: '/', // Specify the path
        }
    }
}

export const getAuthfromCookies = async function 
        ( req: HelloRequest, res?: HelloResponse )
        : Promise<Auth> {

    const cookies = parse(req.headers()?.cookie || '')
    
    if (cookies[oidcName] && res) // clear OIDC cookie if still there
        clearOidcCookie(res)

    const authCookie = cookies[authName]
    if (!authCookie)
        return NotLoggedIn
    try {
        const auth = await decryptObj( authCookie, config.secret as string) as Auth | undefined 
        if (auth) {
            if (auth.isLoggedIn && config.cookieToken)
                auth.cookieToken = authCookie
            return auth
        }
    } catch( e ) {
        if (res) clearAuthCookie( res )
        console.error(e)
    }
    return NotLoggedIn
}


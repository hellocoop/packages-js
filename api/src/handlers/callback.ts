import { HelloRequest, HelloResponse } from '../types'
import config from '../lib/config'
import { getOidc, clearOidcCookie } from '../lib/oidc'
import {
    errorPage,
    ErrorPageParams,
    sameSiteCallback,
} from '@hellocoop/helper-server'
import { saveAuthCookie, clearAuthCookie } from '../lib/auth'
import { performTokenExchange } from './exchange'

// export const getCallbackRequest = (req: HelloRequest): CallbackRequest => {
//     return {
//         getHeaders: () => { return req.headers() }
//     }
// }

// export const getCallbackResponse = (res: HelloResponse): CallbackResponse => {
//     return {
//         getHeaders: () => { return res.getHeaders() },
//         setHeader: (key: string, value: string | string[]) => { res.setHeader(key, value) },
//         setCookie: (key: string, value: string, options: any) => { res.setCookie(key, value, options) },
//     }
// }

const sendErrorPage = (
    error: Record<string, any>,
    target_uri: string,
    res: HelloResponse,
) => {
    clearAuthCookie(res)

    // note that we send errors to the target_uri if it was passed in the original request
    const error_uri = target_uri || config.routes.error
    if (error_uri) {
        const [pathString, queryString] = error_uri.split('?')
        const searchParams = new URLSearchParams(queryString)
        for (const key in error) {
            if (key.startsWith('error')) {
                searchParams.set(key, error[key])
            }
        }
        const url = pathString + '?' + searchParams.toString()
        return res.redirect(url)
    }
    const params: ErrorPageParams = {
        error: error.error,
        error_description: error.error_description,
        error_uri: error.error_uri,
        target_uri: config.routes.loggedIn || '/',
    }
    const page = errorPage(params)
    res.send(page)
}

const handleCallback = async (req: HelloRequest, res: HelloResponse) => {
    const { code, error, same_site, wildcard_domain, app_name } = req.query

    if (config.sameSiteStrict && !same_site)
        // we need to bounce so we get cookies
        return res.send(sameSiteCallback())

    const oidcState = await getOidc(req, res)

    if (!oidcState)
        return sendErrorPage(
            {
                error: 'invalid_request',
                error_description: 'OpenID Connect cookie lost',
            },
            '',
            res,
        )

    const { code_verifier, nonce, redirect_uri } = oidcState

    let { target_uri } = oidcState

    if (error) return sendErrorPage(req.query, target_uri, res)
    if (!code)
        return sendErrorPage(
            {
                error: 'invalid_request',
                error_description: 'Missing code parameter',
            },
            target_uri,
            res,
        )
    if (Array.isArray(code))
        return sendErrorPage(
            {
                error: 'invalid_request',
                error_description: 'Received more than one code',
            },
            target_uri,
            res,
        )

    if (!code_verifier) {
        sendErrorPage(
            {
                error: 'invalid_request',
                error_description: 'Missing code_verifier from session',
            },
            target_uri,
            res,
        )
        return
    }

    try {
        clearOidcCookie(res) // clear cookie so we don't try to use code again

        // Use shared token exchange logic
        const result = await performTokenExchange({
            code: code.toString(),
            code_verifier,
            nonce,
            redirect_uri,
            target_uri,
            loginSyncWrapper: req.loginSyncWrapper,
        })

        if ('error' in result) {
            return sendErrorPage(result, target_uri, res)
        }

        const { auth } = result
        target_uri = target_uri || config.routes.loggedIn || '/'

        if (wildcard_domain) {
            // the redirect_uri is not registered at Hellō - prompt to add
            const appName =
                (Array.isArray(app_name) ? app_name[0] : app_name) || 'Your App'

            const queryString = new URLSearchParams({
                uri: Array.isArray(wildcard_domain)
                    ? wildcard_domain[0]
                    : wildcard_domain,
                appName,
                redirectURI: redirect_uri,
                targetURI: target_uri,
                wildcard_console: 'true',
            }).toString()

            target_uri = config.apiRoute + '?' + queryString
        }

        await saveAuthCookie(res, auth)
        if (config.sameSiteStrict) res.json({ target_uri })
        else res.redirect(target_uri)
    } catch (error: any) {
        clearOidcCookie(res)
        return res.status(500).send(error.message)
    }
}

export default handleCallback

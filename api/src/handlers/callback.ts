import { HelloRequest, HelloResponse } from '../types'
import config from '../lib/config'
import { getOidc, clearOidcCookie } from '../lib/oidc'
import {
    fetchToken,
    parseToken,
    errorPage,
    ErrorPageParams,
    sameSiteCallback,
} from '@hellocoop/helper-server'
import { saveAuthCookie, clearAuthCookie } from '../lib/auth'
import { Auth, VALID_IDENTITY_CLAIMS } from '@hellocoop/definitions'

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
        const token = await fetchToken({
            code: code.toString(),
            wallet: config.helloWallet,
            code_verifier,
            redirect_uri,
            client_id: config.clientId as string,
        })

        const { payload } = parseToken(token)

        if (payload.aud != config.clientId) {
            return sendErrorPage(
                {
                    error: 'invalid_client',
                    error_description: 'Wrong ID token audience',
                },
                target_uri,
                res,
            )
        }
        if (payload.nonce != nonce) {
            return sendErrorPage(
                {
                    error: 'invalid_request',
                    error_description: 'Wrong nonce in ID token',
                },
                target_uri,
                res,
            )
        }

        const currentTimeInt = Math.floor(Date.now() / 1000)
        if (payload.exp < currentTimeInt) {
            return sendErrorPage(
                {
                    error: 'invalid_request',
                    error_description: 'The ID token has expired.',
                },
                target_uri,
                res,
            )
        }
        if (payload.iat > currentTimeInt + 5) {
            // 5 seconds of clock skew
            return sendErrorPage(
                {
                    error: 'invalid_request',
                    error_description: 'The ID token is not yet valid',
                },
                target_uri,
                res,
            )
        }

        let auth = {
            isLoggedIn: true,
            sub: payload.sub,
            iat: payload.iat,
        } as Auth

        VALID_IDENTITY_CLAIMS.forEach((claim) => {
            const value = (payload as any)[claim]
            if (value) (auth as any)[claim] = value
        })
        if (auth.isLoggedIn && payload.org) auth.org = payload.org

        if (config?.loginSync) {
            try {
                if (config.logDebug)
                    console.log(
                        '\n@hellocoop/api loginSync passing:\n',
                        JSON.stringify({ payload, target_uri }, null, 2),
                    )
                const cb = await req.loginSyncWrapper(config.loginSync, {
                    token,
                    payload,
                    target_uri,
                })
                if (config.logDebug)
                    console.log(
                        '\n@hellocoop/api loginSync returned:\n',
                        JSON.stringify(cb, null, 2),
                    )
                target_uri = cb?.target_uri || target_uri
                if (cb?.accessDenied) {
                    return sendErrorPage(
                        {
                            error: 'access_denied',
                            error_description: 'loginSync denied access',
                        },
                        target_uri,
                        res,
                    )
                } else if (cb?.updatedAuth) {
                    auth = {
                        ...cb.updatedAuth,
                        isLoggedIn: true,
                        sub: payload.sub,
                        iat: payload.iat,
                    }
                }
            } catch (e) {
                console.error(new Error('callback faulted'))
                console.error(e)
                return sendErrorPage(
                    {
                        error: 'server_error',
                        error_description: 'loginSync failed',
                    },
                    target_uri,
                    res,
                )
            }
        }

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
        target_uri = target_uri || config.routes.loggedIn || '/'
        await saveAuthCookie(res, auth)
        if (config.sameSiteStrict) res.json({ target_uri })
        else res.redirect(target_uri)
    } catch (error: any) {
        clearOidcCookie(res)
        return res.status(500).send(error.message)
    }
}

export default handleCallback

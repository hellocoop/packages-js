import { HelloRequest, HelloResponse } from '../types'
import {
    fetchToken,
    parseToken,
    decryptObj,
    encryptObj,
} from '@hellocoop/helper-server'
import { Auth, VALID_IDENTITY_CLAIMS } from '@hellocoop/definitions'
import config from '../lib/config'

export interface TokenExchangeError {
    error: string
    error_description: string
}

export interface AuthExchangeResult {
    id_token: string
    auth: Auth
}

// Shared token exchange logic that returns Auth object - can be used by both callback and exchange handlers
export const performTokenExchange = async (params: {
    code: string
    code_verifier?: string
    nonce?: string
    redirect_uri?: string
    target_uri?: string
    encrypted_state?: string
    loginSyncWrapper?: (loginSync: any, data: any) => Promise<any>
}): Promise<AuthExchangeResult | TokenExchangeError> => {
    const { code, loginSyncWrapper } = params
    let { code_verifier, nonce, redirect_uri, target_uri } = params

    try {
        // If encrypted_state is provided, decrypt it to get OIDC parameters
        if (params.encrypted_state) {
            const oidcState = (await decryptObj(
                params.encrypted_state,
                config.secret as string,
            )) as {
                nonce: string
                code_verifier: string
                redirect_uri: string
                target_uri: string
            }

            if (!oidcState || !oidcState.code_verifier) {
                return {
                    error: 'invalid_request',
                    error_description: 'Invalid state parameter',
                }
            }

            code_verifier = oidcState.code_verifier
            nonce = oidcState.nonce
            redirect_uri = oidcState.redirect_uri
            target_uri = oidcState.target_uri
        }

        if (!code_verifier || !nonce || !redirect_uri) {
            return {
                error: 'invalid_request',
                error_description: 'Missing required OIDC parameters',
            }
        }

        // Exchange code for token
        const token = await fetchToken({
            code: code.toString(),
            wallet: config.helloWallet,
            code_verifier,
            redirect_uri,
            client_id: config.clientId as string,
        })

        const result = parseToken(token)
        const payload = result.payload

        // Basic token validation
        if (payload.aud != config.clientId) {
            return {
                error: 'invalid_client',
                error_description: 'Wrong ID token audience',
            }
        }

        if (payload.nonce != nonce) {
            return {
                error: 'invalid_request',
                error_description: 'Wrong nonce in ID token',
            }
        }

        const currentTimeInt = Math.floor(Date.now() / 1000)
        if (payload.exp < currentTimeInt) {
            return {
                error: 'invalid_request',
                error_description: 'The ID token has expired.',
            }
        }

        if (payload.iat > currentTimeInt + 5) {
            // 5 seconds of clock skew
            return {
                error: 'invalid_request',
                error_description: 'The ID token is not yet valid',
            }
        }

        // Construct Auth object
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

        // Handle loginSync if provided
        if (config?.loginSync && loginSyncWrapper) {
            try {
                if (config.logDebug)
                    console.log(
                        '\n@hellocoop/api loginSync passing:\n',
                        JSON.stringify({ payload, target_uri }, null, 2),
                    )
                const cb = await loginSyncWrapper(config.loginSync, {
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
                    return {
                        error: 'access_denied',
                        error_description: 'loginSync denied access',
                    }
                } else if (cb?.updatedAuth) {
                    auth = {
                        ...cb.updatedAuth,
                        isLoggedIn: true,
                        sub: payload.sub,
                        iat: payload.iat,
                    }
                }
            } catch (e) {
                console.error(new Error('loginSync faulted'))
                console.error(e)
                return {
                    error: 'server_error',
                    error_description: 'loginSync failed',
                }
            }
        }

        return {
            id_token: token,
            auth,
        }
    } catch (error) {
        console.error('Token exchange error:', error)
        return {
            error: 'server_error',
            error_description:
                error instanceof Error
                    ? error.message
                    : 'Failed to exchange code for tokens',
        }
    }
}

// Handler for op=exchange
const handleTokenExchange = async (req: HelloRequest, res: HelloResponse) => {
    const { code, state } = req.query

    if (!code) {
        res.status(400)
        return res.send(
            JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing code parameter',
            }),
        )
    }

    if (!state) {
        res.status(400)
        return res.send(
            JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing state parameter',
            }),
        )
    }

    try {
        const result = await performTokenExchange({
            code: code as string,
            encrypted_state: state as string,
        })

        if ('error' in result) {
            res.status(400)
            return res.send(JSON.stringify(result))
        }

        // For mobile apps, encrypt the auth object to create the access_token
        const access_token = await encryptObj(
            result.auth,
            config.secret as string,
        )
        if (!access_token) {
            res.status(500)
            return res.send(
                JSON.stringify({
                    error: 'server_error',
                    error_description: 'Failed to generate access token',
                }),
            )
        }

        return res.json({
            access_token,
            auth: result.auth,
        })
    } catch (error) {
        console.error('Token exchange error:', error)
        res.status(500)
        return res.send(
            JSON.stringify({
                error: 'server_error',
                error_description:
                    error instanceof Error
                        ? error.message
                        : 'Failed to exchange code for tokens',
            }),
        )
    }
}

export default handleTokenExchange

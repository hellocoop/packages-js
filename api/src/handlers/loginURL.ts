import { HelloRequest, HelloResponse } from '../types'
import {
    createAuthRequest,
    ICreateAuthRequest,
    encryptObj,
} from '@hellocoop/helper-server'
import { Scope, ProviderHint } from '@hellocoop/definitions'

import config from '../lib/config'

export interface LoginURLResult {
    url: string
    state: string
}

export interface LoginURLError {
    error: string
    error_description: string
}

// Reusable function that can be called from other handlers
export const createLoginURL = async (params: {
    provider_hint?: string | string[]
    scope?: string | string[]
    target_uri?: string | string[]
    redirect_uri?: string | string[]
    nonce?: string | string[]
    prompt?: string | string[]
    login_hint?: string | string[]
    domain_hint?: string | string[]
}): Promise<LoginURLResult | LoginURLError> => {
    const {
        provider_hint: providerParam,
        scope: scopeParam,
        target_uri,
        redirect_uri,
        nonce: providedNonce,
        prompt,
        login_hint,
        domain_hint,
    } = params

    if (!config.clientId) {
        return {
            error: 'server_error',
            error_description: 'Missing HELLO_CLIENT_ID configuration',
        }
    }

    const redirectURI = config.redirectURI || (redirect_uri as string)
    if (!redirectURI) {
        return {
            error: 'server_error',
            error_description: 'Missing redirect URI configuration',
        }
    }

    // parse out param strings
    const targetURIstring = (
        Array.isArray(providerParam) ? providerParam[0] : providerParam
    ) as string
    const provider_hint = targetURIstring?.split(' ').map((s) => s.trim()) as
        | ProviderHint[]
        | undefined
    const scopeString = (
        Array.isArray(scopeParam) ? scopeParam[0] : scopeParam
    ) as string
    const scope = scopeString?.split(' ').map((s) => s.trim()) as
        | Scope[]
        | undefined

    const request: ICreateAuthRequest = {
        redirect_uri: redirectURI,
        client_id: config.clientId,
        wallet: config.helloWallet,
        scope,
        provider_hint,
        login_hint: Array.isArray(login_hint) ? login_hint[0] : login_hint,
        domain_hint: Array.isArray(domain_hint) ? domain_hint[0] : domain_hint,
        prompt: Array.isArray(prompt) ? prompt[0] : prompt,
    }
    if (providedNonce) {
        request.nonce = Array.isArray(providedNonce)
            ? providedNonce[0]
            : providedNonce
    }

    try {
        const { url, nonce, code_verifier } = await createAuthRequest(request)

        // Encrypt state to save in cookie or return caller
        const state = await encryptObj(
            {
                nonce,
                code_verifier,
                redirect_uri: redirectURI,
                target_uri: (Array.isArray(target_uri)
                    ? target_uri[0]
                    : target_uri) as string,
            },
            config.secret as string,
        )

        return {
            url,
            state,
        }
    } catch (error) {
        console.error('Error creating auth request:', error)
        return {
            error: 'server_error',
            error_description: 'Failed to create authentication request',
        }
    }
}

// Handler for op=loginURL
const handleLoginURL = async (req: HelloRequest, res: HelloResponse) => {
    const result = await createLoginURL(req.query)

    if ('error' in result) {
        res.status(500)
        return res.send(JSON.stringify(result))
    }

    return res.json(result)
}

export default handleLoginURL

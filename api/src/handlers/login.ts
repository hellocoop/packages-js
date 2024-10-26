import { HelloRequest, HelloResponse } from '../types'
import { createAuthRequest, redirectURIBounce, ICreateAuthRequest } from '@hellocoop/helper-server'
import { Scope, ProviderHint } from '@hellocoop/definitions'

import config from '../lib/config'
import { saveOidc } from '../lib/oidc'

export const redirectURIs: Record<string, any> = {}

// var callCount = 0 // DEBUG

const handleLogin = async (req: HelloRequest, res: HelloResponse) => {
    const { provider_hint: providerParam, scope: scopeParam, target_uri, redirect_uri, nonce: providedNonce, prompt, login_hint, domain_hint } = req.query
    
    if (!config.clientId) {
        res.status(500)
        res.send('Missing HELLO_CLIENT_ID configuration')
        return
    }

// callCount++
// console.log('login called:',callCount)

    let redirectURI = config.redirectURI as string
    let host = req.headers()?.host as string
    if (!redirectURI) {
        if (redirectURIs[host]) {
            redirectURI = redirectURIs[host]
        } else {
            if (redirect_uri) {
//                 const redirectUriString =  (Array.isArray(redirect_uri) ? redirect_uri[0] : redirect_uri) as string
//                 const redirectHost = (new URL(redirectUriString)).host
//                 if (redirectHost != host) {
// // TBd -- this might happen if we are behind a proxy where our host and the browser host are different -- look at X-headerrs
//                     const err = `host from redirect_uri=${redirectHost}, expected ${host}`
//                     console.error(err)
//                     res.status(500)
//                     res.send(err)
//                     return 
//                 }
                redirectURIs[host] = redirectURI = redirect_uri as string
                console.log(`Hellō: RedirectURI for ${host} => ${redirectURI}`)
            } else {            
                console.log('Hellō: Discovering API RedirectURI route ...')
                return res.send(redirectURIBounce())        
            }
        }
    }
    // parse out param strings
    const targetURIstring = (Array.isArray(providerParam) ? providerParam[0] : providerParam) as string
    const provider_hint = targetURIstring?.split(' ').map((s) => s.trim()) as ProviderHint[] | undefined
    const scopeString = (Array.isArray(scopeParam) ? scopeParam[0] : scopeParam) as string
    const scope = scopeString?.split(' ').map((s) => s.trim()) as Scope[] | undefined

    const request: ICreateAuthRequest = {
        redirect_uri: redirectURI,
        client_id: config.clientId,
        wallet: config.helloWallet,
        scope,
        provider_hint,
        login_hint,
        domain_hint,
        prompt
    }
    if (providedNonce)
        request.nonce = providedNonce
    const { url, nonce, code_verifier } = await createAuthRequest(request)
    await saveOidc( req, res, {
        nonce,
        code_verifier,
        redirect_uri: redirectURI,
        target_uri: (Array.isArray(target_uri) ? target_uri[0] : target_uri) as string
    })
    res.redirect(url)
}

export default handleLogin
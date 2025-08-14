import { HelloRequest, HelloResponse } from '../types'
import { redirectURIBounce, decryptObj } from '@hellocoop/helper-server'

import config from '../lib/config'
import { saveOidc } from '../lib/oidc'
import { createLoginURL } from './loginURL'

const handleLogin = async (req: HelloRequest, res: HelloResponse) => {
    if (!config.clientId) {
        res.status(500)
        res.send('Missing HELLO_CLIENT_ID configuration')
        return
    }

    const redirectURI = config.redirectURI || (req.query.redirect_uri as string)
    if (!redirectURI) {
        console.log('Hellō: Discovering API RedirectURI route ...')
        return res.send(redirectURIBounce())
    }

    // Use the shared createLoginURL function
    const result = await createLoginURL(req.query)

    if ('error' in result) {
        res.status(500)
        res.send(result.error_description)
        return
    }

    // For web login, we need to extract the state and save it as a cookie
    // The state contains encrypted OIDC parameters, we need to decrypt and re-save as cookie
    const { url, state } = result

    try {
        // The state from createLoginURL is encrypted, but we need to save it as OIDC cookie for web
        // We'll need to decrypt it first, then save it using saveOidc
        const oidcData = await decryptObj(state, config.secret as string)

        if (!oidcData) {
            throw new Error('Failed to decrypt state data')
        }

        await saveOidc(req, res, oidcData as any)
        res.redirect(url)
    } catch (error) {
        console.error('Error processing login:', error)
        res.status(500)
        res.send('Failed to initiate login')
    }
}

export default handleLogin

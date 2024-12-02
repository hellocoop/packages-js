// start an invite flow at /invite


import { HelloRequest, HelloResponse } from '../types'
import { getAuthfromCookies} from '../lib/auth'
import { redirectURIs } from './login'
import { redirectURIBounce } from '@hellocoop/helper-server'

import config from '../lib/config'


// var callCount = 0 // DEBUG

const handleInvite = async (req: HelloRequest, res: HelloResponse) => {
    const { target_uri, app_name, prompt, role, tenant, state, redirect_uri } = req.query

    const auth = await getAuthfromCookies(req,res)
    if (!auth.isLoggedIn) return res.status(401).send('Not logged in')
    if (!auth.sub)        return res.status(401).send('Missing sub in auth')
    if (!auth.email)      return res.status(401).send('Missing email in auth')
    if (!auth.name)       return res.status(401).send('Missing name in auth')
    if(!app_name)         return res.status(400).send('Missing app_name')

    let redirectURI = config.redirectURI as string
    let host = req.headers()?.host as string
    if (!redirectURI) {
        if (redirectURIs[host]) {
            redirectURI = redirectURIs[host]
        } else {
            if (redirect_uri) {
                redirectURIs[host] = redirectURI = redirect_uri as string
                console.log(`Hellō: RedirectURI for ${host} => ${redirectURI}`)
            } else {            
                console.log('Hellō: Discovering API RedirectURI route ...')
                return res.send(redirectURIBounce())        
            }
        }
    }
    const parsedRedirectURI = new URL(redirectURI)
    const defaultTargetURI = parsedRedirectURI.origin + '/'
    const defaultPrompt = `${auth.name} has invited you to join ${app_name}`
    
    const request = {
        app_name: app_name as string,
        prompt: prompt || defaultPrompt,
        role: role as string,
        tenant: tenant as string,
        state: state as string,
        inviter: auth.sub,
        client_id: config.clientId,
        initiate_login_uri: redirectURI,
        return_uri: target_uri || defaultTargetURI,
    }
    const url = `https://wallet.${config.helloDomain}/invite?${new URLSearchParams(request as any)}`
    res.redirect(url)
}

export default handleInvite
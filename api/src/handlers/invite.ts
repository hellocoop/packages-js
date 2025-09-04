// start an invite flow at /invite

import { HelloRequest, HelloResponse } from '../types'
import { getAuthfromCookies } from '../lib/auth'
import { redirectURIBounce } from '@hellocoop/helper-server'

import config from '../lib/config'

// var callCount = 0 // DEBUG

const handleInvite = async (req: HelloRequest, res: HelloResponse) => {
    const { target_uri, app_name, prompt, role, tenant, state, redirect_uri } =
        req.query

    const auth = await getAuthfromCookies(req, res)
    if (!auth.isLoggedIn) return res.status(401).send('Not logged in')
    if (!auth.sub) return res.status(401).send('Missing sub in auth')
    if (!auth.email) return res.status(401).send('Missing email in auth')
    if (!auth.name) return res.status(401).send('Missing name in auth')
    if (!app_name) return res.status(400).send('Missing app_name')

    const redirectURI = config.redirectURI || (redirect_uri as string)
    if (!redirectURI) {
        console.log('Hellō: Discovering API RedirectURI route ...')

        // Validate query parameters server-side before bounce
        const allowedParams = [
            'op',
            'target_uri',
            'app_name',
            'prompt',
            'role',
            'tenant',
            'state',
            'redirect_uri',
        ]
        const safeQuery: Record<string, string> = {}

        Object.entries(req.query).forEach(([key, value]) => {
            if (allowedParams.includes(key) && typeof value === 'string') {
                // Remove any HTML/script content
                const cleanValue = value.replace(/<[^>]*>/g, '').trim()
                if (cleanValue) {
                    safeQuery[key] = cleanValue
                }
            }
        })

        // Add security headers
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader(
            'Content-Security-Policy',
            "script-src 'unsafe-inline'; object-src 'none'; base-uri 'self';",
        )

        return res.send(redirectURIBounce(safeQuery))
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
    const url = `${config.helloWallet}/invite?${new URLSearchParams(request as any)}`
    res.redirect(url)
}

export default handleInvite

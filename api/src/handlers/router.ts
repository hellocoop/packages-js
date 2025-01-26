import { HelloRequest, HelloResponse } from '../types'

import config from '../lib/config'
import handleCallback from './callback'
import handleLogin from './login'
import handleLogout from './logout'
import handleInvite from './invite'
import handleCommand from './command'
// import { handleAuth, handleCookieTokenVerify } from './auth'
import { handleAuth } from './auth'
import handleWildcardConsole from './wildcard'
import initiateLogin from './initiateLogin'
import { NotLoggedIn } from '@hellocoop/definitions'    

const router = (req: HelloRequest, res: HelloResponse ) => {
    const { query, method } = req

    if (config.logDebug) console.log('\n@hellocoop/api:\n', JSON.stringify({ method, query, params: req.body }, null, 2))

    if (method === 'POST') {
        // if (query.op === 'verifyCookieToken') {
        //     return handleCookieTokenVerify(req, res)
        // }
        const params = req.body

        // TODO -- do we need to parse body?
        // it is `application/x-www-form-urlencoded` encoded

        if (!params) {
            console.log('Invalid request')
            return res.status(400).send('Invalid request')
        }
        if (params.iss || params.domain_hint || params.login_hint) {
            return initiateLogin(req, res, params)
        }
        if (params.command_token) {
            return handleCommand(req, res, params)
        }

        // FUTURE - add support for POST of invite event and provisioning events

        return res.status(400).send('Invalid op parameter')
    }

    if (!query) {
        // Q: repurpose as returning configuration if content-type is application/json
        console.error(new Error('No query parameters'))
        return res.redirect( config.routes.loggedOut || '/')
    }

    if (method !== 'GET')
        return res.status(400).send('Method not allowed')
    if (query.op) { // not a protocol flow
        if (query.op === 'auth' || query.op === 'getAuth') {
            if (config.error) {
                return res.json(NotLoggedIn)    
            } else {
                return handleAuth(req, res)                 
            } 
        }
        if (query.op === 'login') { // start login flow, redirect to Hellō
            return handleLogin(req, res)
        }
        if (query.op === 'logout') {     // logout user
            return handleLogout(req, res)
        }
        if (query.op === 'invite') {    // start invite flow, redirect to Hellō
            return handleInvite(req, res)
        }
        res.status(500)
        res.send('unknown op parameter:\n'+JSON.stringify(query,null,4))        
        return
    }
    if (config.error) { // not able to process requests
        res.status(500)
        res.send('Missing configuration:\n'+JSON.stringify(config.error,null,4))
        return
    }

    if (query.code || query.error) { // authorization response
        return handleCallback(req, res)
    }

    if (query.wildcard_console) {
        return handleWildcardConsole(req, res)
    }

    if (query.iss || query.domain_hint || query.login_hint) {        // IdP initiated login
        return initiateLogin(req, res, query as any)
    }


    res.status(500)
    res.send('unknown query:\n'+JSON.stringify(query,null,4))
}

export default router
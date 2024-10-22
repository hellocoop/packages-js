import { HelloRequest, HelloResponse } from '../types'

import config from '../lib/config'
import handleCallback from './callback'
import handleLogin from './login'
import handleLogout from './logout'
import handleInvite from './invite'
import { handleAuth, handleCookieTokenVerify } from './auth'
import handleWildcardConsole from './wildcard'
import initiateLogin from './initiateLogin'
import { NotLoggedIn } from '@hellocoop/constants'    

const router = (req: HelloRequest, res: HelloResponse ) => {
    const { query, method } = req

    const params = Object.keys(query).length 
        ? query
        : Object.keys(req.body).length ? req.body : null

    if (config.logDebug) console.log('\n@hellocoop/api:\n', JSON.stringify({ method, params }, null, 2))

    if (!params) {
        // Q: repurpose as returning configuration if content-type is application/json
        console.error(new Error('No query parameters'))
        return res.redirect( config.routes.loggedOut || '/')
    }
    if (method === 'POST') {
        if (query.op === 'verifyCookieToken') {
            return handleCookieTokenVerify(req, res)
        }
        if (params.iss) {
            return initiateLogin(req, res, params)
        }

        // FUTURE - add support for POST of invite event and provisioning events

        return res.status(400).send('Invalid op parameter')
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

    if (params.iss) {        // IdP (Hellō) initiated login
        return initiateLogin(req, res, params)
    }


    res.status(500)
    res.send('unknown query:\n'+JSON.stringify(query,null,4))
}

export default router
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

const router = async (req: HelloRequest, res: HelloResponse ) => {
    const { query, method } = req

    if (config.logDebug) console.log('\n@hellocoop/api:\n', JSON.stringify({ method, query, params: req.body }, null, 2))

    if (method === 'POST') {
        const params = req.body

        if (params.iss || params.domain_hint || params.login_hint) {
            return res.redirect(config.apiRoute+'/?'+new URLSearchParams(params as any))
        }
        if (params.command_token) {
            return await handleCommand(req, res, params)
        }
        // we don't know how to process the POST
        const keys = Object.keys(params)
        if (!keys || keys.length === 0) {
            console.error('No POST parameters found')
            return res.status(400).send('Invalid request')
        }
        const message = 'Unknown POST parameters: '+JSON.stringify(keys)
        console.error(message)
        return res.status(400).send(message)
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
                return await handleAuth(req, res)                 
            } 
        }
        if (query.op === 'login') { // start login flow, redirect to Hellō
            return await handleLogin(req, res)
        }
        if (query.op === 'logout') {     // logout user
            return await handleLogout(req, res)
        }
        if (query.op === 'invite') {    // start invite flow, redirect to Hellō
            return await handleInvite(req, res)
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
        return await handleCallback(req, res)
    }

    if (query.wildcard_console) {
        return await handleWildcardConsole(req, res)
    }

    if (query.iss || query.domain_hint || query.login_hint) {        // IdP initiated login
        return await initiateLogin(req, res, query as any)
    }


    res.status(500)
    res.send('unknown query:\n'+JSON.stringify(query,null,4))
}

export default router
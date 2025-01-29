// Third Party Initiated Login
// https://openid.net/specs/openid-connect-core-1_0.html#ThirdPartyInitiatedLogin

import { HelloRequest, HelloResponse } from '../types'
import handleLogin from './login'
import config from '../lib/config'

type InitiateLoginParams = {
    iss?: string,
    login_hint?: string,
    domain_hint?: string,
    target_link_uri?: string,
    redirect_uri?: string
}

const initiateLogin = async (req: HelloRequest, res: HelloResponse, params: InitiateLoginParams  ) => {
    const { iss, login_hint, domain_hint, target_link_uri, redirect_uri } = params

    const issuer = `https://issuer.${config.helloDomain}`
    if (iss && (iss !== issuer)) {
        return res.send(`Passed iss '${iss}' must be '${issuer}'`)
    }
    req.query = {} // override query params
    if (target_link_uri) {
        req.query.target_uri = target_link_uri
    }
    if (redirect_uri) {
        req.query.redirect_uri = redirect_uri
    }
    if (login_hint) {
        req.query.login_hint = login_hint
    } else if (domain_hint) { // if both are passed, login_hint takes precedence
        req.query.domain_hint = domain_hint
    }
    return handleLogin(req, res)
}

export default initiateLogin
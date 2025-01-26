// Third Party Initiated Login
// https://openid.net/specs/openid-connect-core-1_0.html#ThirdPartyInitiatedLogin

import { HelloRequest, HelloResponse } from '../types'
import handleLogin from './login'
import config from '../lib/config'

type InitiateLoginParams = {
    iss: string,
    login_hint: string,
    domain_hint: string,
    target_link_uri: string,
}

const initiateLogin = async (req: HelloRequest, res: HelloResponse, params: InitiateLoginParams  ) => {
    const { iss, login_hint, domain_hint, target_link_uri } = params

    const issuer = `https://issuer.${config.helloDomain}`
    if (iss && (iss !== issuer)) {
        return res.send(`Passed iss '${iss}' must be '${issuer}'`)
    }
    req.query = { // override query params
        target_uri: target_link_uri,
    }
    if (login_hint) {
        req.query.login_hint = login_hint
    } else if (domain_hint) {
        req.query.domain_hint = domain_hint
    }
    return handleLogin(req, res)
}

export default initiateLogin
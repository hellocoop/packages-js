import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { withIronSessionApiRoute } from 'iron-session/next'
import { createAuthRequest } from '@hellocoop/utils'
import type { Config } from '../lib/config'

const handleLoginFactory = (config: Config): NextApiHandler =>
    withIronSessionApiRoute(async (req: NextApiRequest, res: NextApiResponse) => {
        const { target_uri, scope } = req.query

        if (!config.baseUrl) {
            res.status(500).end('Missing baseUrl configuration')
            return
        }
        if (!config.helloClientId) {
            res.status(500).end('Missing helloClientId configuration')
            return
        }
        const { url, nonce, code_verifier } = await createAuthRequest({
            redirect_uri: config.baseUrl,
            client_id: config.helloClientId
            // TODO -- pass in scope from environment / config or passed in call
        })
        req.session.oidc = {
            nonce,
            code_verifier
        }

        console.log('login.ts')
        console.log(JSON.stringify(req.session, null, 4));


        await req.session.save()
        res.redirect(url)
    }, config.sessionOptions)

export default handleLoginFactory

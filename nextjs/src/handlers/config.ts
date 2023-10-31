import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'

import { isConfigured, configure } from '../lib/config'
import router from './router'
import { Claims, Scope } from '@hellocoop/types'

export  { Claims, Scope }

export type LoggedInParams = {
    token: string,
    payload: Claims,
    req: NextApiRequest,
    res: NextApiResponse
}


export type LoggedInResponse = {
    accessDenied?: boolean,
    isProcessed?: boolean,
    updatedAuth?: {[key: string]: any}
}


export type Config = {
    client_id: string,
    scope?: Scope[],
    callbacks?: {
        loggedIn?: (params: LoggedInParams) => Promise<LoggedInResponse>
    },
    routes?: {
        loggedIn?: string,
        loggedOut?: string,
        error?: string
    }
}

export const pageAuth = function ( config: Config): NextApiHandler {
    if (!isConfigured) {
        configure(config as Config)
    }
    return router
}

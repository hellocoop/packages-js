import type { IronSessionOptions } from 'iron-session'

import type { User } from './user'

export type OIDC = {
    nonce: string;
    code_verifier: string
}
// type of req.session.*
declare module 'iron-session' {
    interface IronSessionData {
        user?: User,
        oidc?: OIDC,
    }
}

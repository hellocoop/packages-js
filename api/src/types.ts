// Helle router types

import type { Claims, Scope, ProviderHint, Auth } from '@hellocoop/definitions'
import type { SerializeOptions } from 'cookie'

// export type CallbackRequest = {
//     getHeaders: () => Record<string, string>,
// }

// export type CallbackResponse = {
//     getHeaders: () => Record<string, string>,
//     setHeader: (key: string, value: string | string[]) => void,
//     setCookie: (key: string, value: string, options: SerializeOptions) => void,
// }

export type GenericSync = (params: any) => Promise<any>

export type LoginSyncParams = {
    token: string
    payload: Claims
    target_uri: string
}

export type LoginSyncResponse = {
    accessDenied?: boolean
    target_uri?: string
    updatedAuth?: { [key: string]: any }
}

export type LogoutSyncResponse = null | Error

type LoginSyncWrapper = (
    loginSync: GenericSync,
    params: LoginSyncParams,
) => Promise<LoginSyncResponse>

type LogoutSyncWrapper = (
    logoutSync: GenericSync,
) => Promise<LogoutSyncResponse>

export interface Config {
    client_id?: string
    scope?: Scope[]
    provider_hint?: ProviderHint[]
    sameSiteStrict?: boolean
    loginSync?: GenericSync
    logoutSync?: GenericSync
    commandHandler?: CommandHandler
    commandsSupported?: Command[]
    audSubRequired?: boolean
    routes?: {
        loggedIn?: string
        loggedOut?: string
        error?: string
    }
    cookieToken?: boolean
    cookieDomain?: string
    logConfig?: boolean
    apiRoute?: string
}

export type HelloRequest = {
    getAuth: () => Auth | undefined
    headers: () => { [key: string]: string }
    path: string
    query: { [key: string]: string }
    setAuth: (auth: Auth) => void
    method: string
    body: any
    loginSyncWrapper: LoginSyncWrapper
    logoutSyncWrapper: LogoutSyncWrapper
    frameWork: string
}

export type HelloResponse = {
    clearAuth: () => void
    send: (data: string) => void
    json: (data: any) => void
    redirect: (url: string) => void
    setCookie: (name: string, value: string, options: SerializeOptions) => void
    setHeader: (name: string, value: string | string[]) => void
    status: (statusCode: number) => { send: (data: any) => void }
    getHeaders: () => Record<string, string>
}

// OpenID Provider Commands draft-02
// https://github.com/openid/openid-provider-commands
export type Command =
    // Tenant Commands
    | 'metadata'
    | 'audit_tenant'
    | 'suspend_tenant'
    | 'archive_tenant'
    | 'delete_tenant'
    | 'invalidate_tenant'
    // Account Commands
    | 'activate'
    | 'maintain'
    | 'suspend'
    | 'reactivate'
    | 'archive'
    | 'restore'
    | 'delete'
    | 'audit'
    | 'invalidate'
    | 'migrate'
    // Asynchronous Account Commands
    | 'activate_async'
    | 'maintain_async'
    | 'suspend_async'
    | 'reactivate_async'
    | 'archive_async'
    | 'restore_async'
    | 'delete_async'
    | 'audit_async'
    | 'invalidate_async'
    | 'migrate_async'

export type CommandClaims = {
    iss: string
    aud: string
    client_id: string
    iat: number
    exp: number
    jti: string
    command: Command
    tenant: string
    // present in Account Commands, prohibited in Tenant Commands
    sub?: string
    aud_sub?: string
    // profile claims that may accompany Account Commands
    email?: string
    email_verified?: boolean
    name?: string
    given_name?: string
    family_name?: string
    groups?: string[]
    roles?: string[]
    // the metadata command carries an OP metadata object
    metadata?: Record<string, unknown>
    [claim: string]: unknown
}

export type CommandHandler = (
    res: HelloResponse,
    claims: CommandClaims,
) => void | Promise<void>

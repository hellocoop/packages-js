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


type LoginSyncParams = {
    token: string,
    payload: Claims,
    target_uri: string,
}

export type LoginSyncResponse = {
    accessDenied?: boolean,
    target_uri?: string,
    updatedAuth?: {[key: string]: any}
}

export type LogoutSyncResponse = null | Error


type LoginSyncWrapper = (loginSync: GenericSync, params: LoginSyncParams) => Promise<LoginSyncResponse>


type LogoutSyncWrapper = (logoutSync: GenericSync) => Promise<LogoutSyncResponse>

export interface Config {
    client_id?: string,
    scope?: Scope[],
    provider_hint?: ProviderHint[],
    sameSiteStrict?: boolean,
    loginSync?: GenericSync,
    logoutSync?: GenericSync,
    routes?: {
        loggedIn?: string,
        loggedOut?: string,
        error?: string
    },
    cookieToken?: boolean,
    logConfig?: boolean,
    apiRoute?: string,
}

export type HelloRequest = {
    getAuth: () => Auth | undefined,
    headers: () => { [key: string]: string };
    path: string;
    query: { [key: string]: string };
    setAuth: ( auth: Auth) => void,
    method: string,
    body: any,
    loginSyncWrapper: LoginSyncWrapper,
    logoutSyncWrapper: LogoutSyncWrapper,
    frameWork: string,
};
  
export type HelloResponse = {
    clearAuth: () => void,
    send: (data: string) => void;
    json: ( data : any ) => void;
    redirect: (url: string) => void;
    setCookie: (name: string, value: string, options: SerializeOptions) => void;
    setHeader: (name: string, value: string | string[]) => void;
    status: (statusCode: number) => { send: (data: any) => void };
    getHeaders: () => Record<string, string>
};



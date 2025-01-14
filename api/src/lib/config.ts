import { Config, GenericSync, CommandHandler, Command } from '../types'
import { Scope, ProviderHint } from '@hellocoop/definitions'
import { checkSecret } from '@hellocoop/helper-server'

export interface IConfig {
    production: boolean,
    sameSiteStrict?: boolean,
    error?: string[],
    scope?: Scope[],
    provider_hint?: ProviderHint[],
    routes: {
        loggedIn?: string,
        loggedOut?: string,
        error?: string
    },
    cookies: {
        authName: string,
        oidcName: string,
    },
    loginSync?: GenericSync,
    logoutSync?: GenericSync,
    commandHandler?: CommandHandler,
    commandsSupported?: Command[],
    cookieToken?: boolean, // include encrypted cookie in auth response
    // built from HELLO_API_ROUTE
    apiRoute: string,
    authApiRoute: string,
    loginApiRoute: string,
    logoutApiRoute: string,
    // configured only by process.env or .env
    clientId?: string,
    host: string | undefined ,
    redirectURI: string | undefined,
    // for internal testing
    helloDomain: string,
    helloWallet: string,
    secret?: string,
    logDebug?: boolean,
}

const HELLO_DOMAIN = process.env.HELLO_DOMAIN as string || 'hello.coop'
const HOST = process.env.HOST || process.env.HELLO_HOST || undefined

const _configuration: IConfig = {
    production: process.env.NODE_ENV === 'production',
    routes: {
        loggedIn: 'not-configured',
        loggedOut: 'not-configured',
    },
    cookies: {
        authName: 'hellocoop_auth',
        oidcName: 'hellocoop_oidc',
    },
    apiRoute: 'not-configured',
    authApiRoute: 'not-configured',
    loginApiRoute: 'not-configured',
    logoutApiRoute: 'not-configured',
    redirectURI: 'not-configured',
    // configured only by process.env or .env
    clientId:  '',
    secret:  process.env.COOKIE_SECRET || process.env.HELLO_COOKIE_SECRET as string,
    host: HOST,
    // for internal testing
    helloDomain: HELLO_DOMAIN,
    helloWallet
        :  process.env.HELLO_WALLET as string
        || 'https://wallet.'+HELLO_DOMAIN,
}

export let isConfigured: boolean = false


const pendingConfigurations: ((config: any) => void)[] = [];

const confirmPath = ( label: string, path: string | undefined ) => {
    if (!path) return undefined
    if (!path.startsWith('/')) {
        console.error(`${label}=${path} ignored, must start with /`)
        return undefined
    }
    return path
}

export const configure = function ( config: Config ) {
    _configuration.clientId = process.env.CLIENT_ID || process.env.HELLO_CLIENT_ID || config.client_id as string
    if (config.routes) {
        _configuration.routes = {
            ..._configuration.routes,
            ...config.routes
        }
    }
    const apiRoute = process.env.HELLO_API_ROUTE || config.apiRoute || '/api/hellocoop'
    _configuration.apiRoute = apiRoute
    _configuration.authApiRoute = apiRoute+'?op=auth'
    _configuration.loginApiRoute = apiRoute+'?op=login'
    _configuration.logoutApiRoute = apiRoute+'?op=logout'
    _configuration.routes = {
        loggedIn: confirmPath( 'process.env.HELLO_LOGGED_IN', process.env.HELLO_LOGGED_IN) 
            || confirmPath( 'config routes.loggedIn', config.routes?.loggedIn) 
            || '/',
        loggedOut: confirmPath( 'process.env.HELLO_LOGGED_OUT',process.env.HELLO_LOGGED_OUT)
            || confirmPath( 'config routes.loggedOut',config.routes?.loggedOut)
            || '/',
        error: confirmPath( 'process.env.HELLO_ERROR' ,process.env.HELLO_ERROR)
            || confirmPath( 'config routes.error',config.routes?.error)
    }
    _configuration.redirectURI = HOST 
            ? `https://${HOST}${apiRoute}` 
            : undefined,

    _configuration.loginSync = config.loginSync
    _configuration.logoutSync = config.logoutSync

    if (process.env.HELLO_SCOPES)
        _configuration.scope = process.env.HELLO_SCOPES.split(' ') as Scope[]
    else
        _configuration.scope = config.scope

    if (process.env.HELLO_PROVIDER_HINT)
        _configuration.provider_hint = process.env.HELLO_PROVIDER_HINT.split(' ') as ProviderHint[]
    else
        _configuration.provider_hint = config.provider_hint

    if (process.env.HELLO_DEBUG)
        _configuration.logDebug = true

    _configuration.sameSiteStrict = !!process.env.HELLO_SAME_SITE_STRICT || config.sameSiteStrict
    _configuration.cookieToken = !!process.env.HELLO_COOKIE_TOKEN || config.cookieToken
    
    isConfigured = true
    if (!_configuration.clientId) {
        const message = 'No CLIENT_ID or HELLO_CLIENT_ID was in environment or client_id in hello.config'
        _configuration.error = [message]
        console.error(message)
        isConfigured = false
    } 
    if (!_configuration.secret) {
        const message = 'No COOKIE_SECRET or HELLO_COOKIE_SECRET was in environment'
        _configuration.error = [message]
        console.error(message)
        isConfigured = false
    } 
    if (_configuration.secret && !checkSecret(_configuration.secret)) {
        const message = 'HELLO_COOKIE_SECRET is not 32 hex digits'
        _configuration.error = [message]
        console.error(message)
        isConfigured = false
    }
    while (pendingConfigurations.length > 0) {
        const resolve = pendingConfigurations.pop();
        if (resolve)
            resolve(_configuration);
      }
    if (config.logConfig)
        console.log('\n@hellocoop/api config:\n',JSON.stringify({config:_configuration},null,2))

}

export const getConfig = function ():Promise<IConfig> {
    if (!isConfigured) {
        return new Promise((resolve) => {
          pendingConfigurations.push(() => resolve(_configuration));
        });
      }
      return Promise.resolve(_configuration);
}

export const getLoginApiRoute = ():string => {return _configuration.loginApiRoute}
export const getLogoutApiRoute = ():string => {return _configuration.logoutApiRoute}
export const getAuthApiRoute = ():string => {return _configuration.authApiRoute}
export const getApiRoute = ():string => {return _configuration.apiRoute}

export default _configuration
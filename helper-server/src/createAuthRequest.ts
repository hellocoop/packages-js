// creates an authorization request URL for Hellō

import { pkce, uuidv4 } from './pkce';
import { 
    Scope,
    AuthResponseMode,
    AuthResponseType,
    ProviderHint,
} from '@hellocoop/types'

import { 
    VALID_SCOPES,   
    VALID_RESPONSE_TYPE,
    VALID_RESPONSE_MODE,
    DEFAULT_PATH,
    DEFAULT_SCOPE,
    DEFAULT_RESPONSE_TYPE,
    DEFAULT_RESPONSE_MODE,
    PRODUCTION_WALLET,
} from '@hellocoop/constants';

import { URLSearchParams } from 'url'

export function isValidScope( scope: string ): boolean {
    return VALID_SCOPES.includes(scope as Scope)
}

export function areScopesValid(scopes: string[]): boolean {
    return scopes.every((scope) => isValidScope(scope));
}

export interface ICreateAuthRequest {
    client_id: string;
    redirect_uri: string;
    scope?: Scope[];
    response_type?: AuthResponseType; 
    response_mode?: AuthResponseMode;
    wallet?: string;
    nonce?: string;
    state?: string;
    login_hint?: string
    domain_hint?: string
    provider_hint?: ProviderHint[];
    prompt?: string;
    account?: string;
}

export interface AuthenticationResponse {
    url: string;
    nonce: string;
    code_verifier: string;
}

export async function createAuthRequest( 
        config: ICreateAuthRequest
    ): Promise<AuthenticationResponse> {
  // Ensure client_id is provided (required)
    if (!config.client_id) {
        throw new Error('client_id is required in the authorization request.');
    }
    if (!config.redirect_uri) {
        throw new Error('redirect_uri is required in the authorization request.');
    }
    // TODO check if redirect_uri is a valid URL

    // TODO check if wallet is valid host or boolean

    if (config.scope) {
        if (!areScopesValid(config.scope))
            throw new Error('One or more passed scopes are invalid.');
        // add in openid scope and make unique
        config.scope = Array.from(new Set([...config.scope, 'openid']));
    }
    if (config.response_type) {
        if (!VALID_RESPONSE_TYPE.includes(config.response_type))
            throw new Error('Invalid response_type.');
    }
    if (config.response_mode) {
        if (!VALID_RESPONSE_MODE.includes(config.response_mode))
            throw new Error('Invalid response_mode.');
    }
    const nonce = config.nonce || uuidv4()
    let code_verifier: string = '' 
    const scopeArray = config.scope || DEFAULT_SCOPE
    const scope = scopeArray.join(' ')
    const params: Record<string, any> = {
        client_id: config.client_id,
        redirect_uri: config.redirect_uri,
        scope,
        response_type: config.response_type || DEFAULT_RESPONSE_TYPE,
        response_mode: config.response_mode || DEFAULT_RESPONSE_MODE,
        nonce,
    }
    if (config.prompt) {
        params.prompt = config.prompt
    }
    if (config.account) {
        params.account = config.account
    }
    if (params.response_type === 'code') {
        const pkceMaterial  = await pkce()
        code_verifier = pkceMaterial.code_verifier
        params.code_challenge = pkceMaterial.code_challenge
        params.code_challenge_method = 'S256'
    }
    if (config.provider_hint) {
        params.provider_hint = config.provider_hint.join(' ')
    }
    if (config.login_hint) {
        params.login_hint = config.login_hint
    }

    const url = (config.wallet || PRODUCTION_WALLET) 
        + DEFAULT_PATH
        + new URLSearchParams(params).toString()
    return {
        url,
        nonce,
        code_verifier 
    }
}
// creates an invite request URL for Hellō

import {  PRODUCTION_WALLET } from '@hellocoop/definitions'

export interface ICreateInviteRequest {
    inviter: string,
    client_id: string,
    initiate_login_uri: string,
    return_uri: string,
    app_name?: string,
    prompt?: string,
    role?: string,
    tenant?: string,
    state?: string,
    events_uri?: string,
    wallet?: string;
}

export interface InviteResponse {
    url: string;
}

export function createInviteRequest( 
        config: ICreateInviteRequest
    ): InviteResponse {
    if (!config.inviter) {
        throw new Error('inviter is required in the invite request.');
    }
    if (!config.client_id) {
        throw new Error('client_id is required in the invite request.');
    } 
    if (!config.initiate_login_uri) {
        throw new Error('initiate_login_uri is required in the invite request.');
    } 
    if (!config.return_uri) {
        throw new Error('return_uri is required in the invite request.');
    }
    const url = new URL('/invite', config.wallet || PRODUCTION_WALLET)
    url.searchParams.set('inviter', config.inviter)
    url.searchParams.set('client_id', config.client_id)
    url.searchParams.set('initiate_login_uri', config.initiate_login_uri)
    url.searchParams.set('return_uri', config.return_uri)
    if (config.app_name) {
        url.searchParams.set('app_name', config.app_name)
    }
    if (config.prompt) {
        url.searchParams.set('prompt', config.prompt)
    }
    if (config.role) {
        url.searchParams.set('role', config.role)
    }
    if (config.tenant) {
        url.searchParams.set('tenant', config.tenant)
    }
    if (config.state) {
        url.searchParams.set('state', config.state)
    }
    if (config.events_uri) {
        url.searchParams.set('events_uri', config.events_uri)
    }
    return { url: url.href }
}
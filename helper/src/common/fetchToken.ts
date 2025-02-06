// fetches an ID token from Hellō given the code and code_verifier

import { PRODUCTION_WALLET } from '@hellocoop/definitions'
const DEFAULT_ENDPOINT: string = '/oauth/token'

export type FetchConfig = {
    code: string
    code_verifier: string
    client_id: string
    redirect_uri: string
    wallet?: string
}

export async function fetchToken({
    code,
    code_verifier,
    client_id,
    redirect_uri,
    wallet,
}: FetchConfig): Promise<string> {
    const params: Record<string, any> = {
        code,
        code_verifier,
        client_id,
        redirect_uri,
        grant_type: 'authorization_code',
    }
    const body = new URLSearchParams(params).toString()
    const tokenEndpoint = (wallet || PRODUCTION_WALLET) + DEFAULT_ENDPOINT

    try {
        const r = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        })
        const json = await r.json()

        if (!r.ok) {
            const message =
                `Fetch ${tokenEndpoint} failed with ${r.status}. ` +
                (json.error ? json.error + '.' : '')
            throw new Error(message)
        }

        if (json.error)
            // should not happen as errors have a non 200 response, but just in case
            throw new Error(json.error)

        if (!json.id_token)
            // should not happen, but just in case
            throw new Error('No id_token in response.')

        return json.id_token
    } catch (error: any) {
        throw new Error(error)
    }
}

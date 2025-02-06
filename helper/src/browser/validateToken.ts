import type { TokenPayload } from '@hellocoop/definitions'
import { PRODUCTION_WALLET } from '@hellocoop/definitions'

const DEFAULT_ENDPOINT: string = '/oauth/introspect'

export type ValidateConfig = {
    token: string
    client_id: string
    nonce?: string
    wallet?: string
}

export interface IntrospectionResponse extends TokenPayload {
    active: boolean
}

export async function validateToken({
    token,
    client_id,
    nonce,
    wallet,
}: ValidateConfig): Promise<IntrospectionResponse> {
    const params: Record<string, any> = {
        token,
        client_id,
        nonce,
    }
    const body = new URLSearchParams(params).toString()
    const introspectEndpoint = (wallet || PRODUCTION_WALLET) + DEFAULT_ENDPOINT

    try {
        const r = await fetch(introspectEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        })
        const json = await r.json()

        if (!r.ok) {
            const message =
                `Fetch ${introspectEndpoint} failed with ${r.status}. ` +
                (json.error ? json.error + '.' : '')
            throw new Error(message)
        }

        if (json.error)
            // should not happen as errors have a non 200 response, but just in case
            throw new Error(json.error)

        return json
    } catch (error: any) {
        throw new Error(error)
    }
}

//
// parseToken - parses an ID token and returns the header and payload
//

import type { TokenPayload, TokenHeader } from '@hellocoop/definitions'

// https://stackoverflow.com/a/38552302/9747630
function parseJwt(token: string): TokenHeader | TokenPayload {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
        window
            .atob(base64)
            .split('')
            .map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            })
            .join(''),
    )

    return JSON.parse(jsonPayload)
}

export function parseToken(token: string): {
    header: TokenHeader
    payload: TokenPayload
} {
    try {
        const [headerEncoded, tokenEncoded] = token.split('.')

        const header = parseJwt(headerEncoded) as TokenHeader
        const payload = parseJwt(tokenEncoded) as TokenPayload

        // TODO - check valid typ header
        // check there is an exp claim

        return {
            header,
            payload,
        }
    } catch (error: any) {
        throw new Error(error)
    }
}

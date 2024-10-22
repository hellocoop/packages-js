// 
// parseToken - parses an ID token and returns the header and payload
//

import { TokenHeader, TokenPayload } from '@hellocoop/types'

export function parseToken( token: string): { header: TokenHeader; payload: TokenPayload} {

    const [headerEncoded,tokenEncoded] = token.split('.')
    const headerJSON = Buffer.from(headerEncoded, 'base64url').toString('utf-8')
    const payloadJSON = Buffer.from(tokenEncoded, 'base64url').toString('utf-8')
    try {
        const header = JSON.parse(headerJSON)
        const payload = JSON.parse(payloadJSON)
        // TODO - check valid typ header 

        // check there is an exp claim

// console.log({header,payload})


        return {
            header,
            payload
        }
    
    } catch(error: any) {
        throw new Error(error);
    }

}
// 
// parseToken - parses an ID token and returns the header and payload
//

import { VALID_IDENTITY_CLAIMS } from './createAuthRequest'

type IdentityClaims = typeof VALID_IDENTITY_CLAIMS[number]

// Create a type with all VALID_IDENTITY_CLAIMS properties as optional
type OptionalClaims = {
  [K in IdentityClaims]?: unknown;
};

export type Claims = OptionalClaims & { sub: string }

export type TokenPayload = OptionalClaims & {
    iss: string;
    aud: string;
    nonce: string;
    jti: string;
    sub: string;
    scope: string[];
    iat: number,
    exp: number,                   
}

export type TokenHeader = {
    typ: string;
    alg: string;
}

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
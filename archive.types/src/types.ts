// Hellō types

import { 
    VALID_IDENTITY_STRING_CLAIMS,
    VALID_IDENTITY_ACCOUNT_CLAIMS,
    VALID_SCOPES,
    VALID_RESPONSE_TYPE,
    VALID_RESPONSE_MODE,
    VALID_PROVIDER_HINT,
} from '@hellocoop/definitions'


export type Scope = typeof VALID_SCOPES[number];
export type AuthResponseType = typeof VALID_RESPONSE_TYPE[number]; 
export type AuthResponseMode = typeof VALID_RESPONSE_MODE[number]; 
export type ProviderHint = typeof VALID_PROVIDER_HINT[number]; 

type IdentityStringClaims = typeof VALID_IDENTITY_STRING_CLAIMS[number]
type IdentityAccountClaims = typeof VALID_IDENTITY_ACCOUNT_CLAIMS[number]

type OptionalStringClaims = {
  [K in IdentityStringClaims]?: string;
};

type OptionalAccountClaims = {
    [K in IdentityAccountClaims]?: {
        id: string;
        username: string;
      };
};    

export type Claims = OptionalStringClaims & OptionalAccountClaims & { sub: string }

type AuthCookie = {
    sub: string,
    iat: number
} & Claims & {
    [key: string]: any; // Allow arbitrary optional properties
}

export type Auth = {
    isLoggedIn: false   
} | ( {
    isLoggedIn: true,
    cookieToken?: string
} & AuthCookie )

export type TokenPayload = OptionalStringClaims & OptionalAccountClaims & {
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

// Hellō constants and types

// Constants
export const PRODUCTION_WALLET: string = 'https://wallet.hello.coop';

export const DEFAULT_SCOPE = ['openid', 'name', 'email', 'picture'] as const;
export const DEFAULT_RESPONSE_TYPE = 'code' as const;
export const DEFAULT_RESPONSE_MODE = 'query' as const;
export const DEFAULT_PATH = '/authorize?' as const;

export const VALID_IDENTITY_STRING_CLAIMS = [
  'name', 'nickname', 'preferred_username', 'given_name', 'family_name', 
  'email', 'phone', 'picture', 'ethereum',
] as const;

export const VALID_IDENTITY_ACCOUNT_CLAIMS = [
  'discord', 'twitter', 'github', 'gitlab'
] as const;

export const VALID_IDENTITY_CLAIMS = [
  ...VALID_IDENTITY_STRING_CLAIMS, 
  ...VALID_IDENTITY_ACCOUNT_CLAIMS, 
  'email_verified', 'phone_verified'
] as const;

export const VALID_SCOPES = [
  ...VALID_IDENTITY_STRING_CLAIMS, 
  ...VALID_IDENTITY_ACCOUNT_CLAIMS, 
  'profile', 'openid', 'profile_update'
] as const;

export const VALID_RESPONSE_TYPE = ['id_token', 'code'] as const;
export const VALID_RESPONSE_MODE = ['fragment', 'query', 'form_post'] as const;

export const VALID_PROVIDER_HINT = [
  'apple', 'discord', 'facebook', 'github', 'gitlab', 'google', 
  'twitch', 'twitter', 'tumblr', 'mastodon', 'microsoft', 'line', 
  'wordpress', 'yahoo', 'phone', 'ethereum', 'qrcode', 
  'apple--', 'microsoft--'
] as const;

export const NotLoggedIn = { isLoggedIn: false } as const;


// Types
export type Scope = typeof VALID_SCOPES[number];
export type AuthResponseType = typeof VALID_RESPONSE_TYPE[number];
export type AuthResponseMode = typeof VALID_RESPONSE_MODE[number];
export type ProviderHint = typeof VALID_PROVIDER_HINT[number];

type IdentityStringClaims = typeof VALID_IDENTITY_STRING_CLAIMS[number];
type IdentityAccountClaims = typeof VALID_IDENTITY_ACCOUNT_CLAIMS[number];

type OptionalStringClaims = {
  [K in IdentityStringClaims]?: string;
};

type OptionalAccountClaims = {
  [K in IdentityAccountClaims]?: {
    id: string;
    username: string;
  };
};

export type Claims = OptionalStringClaims & OptionalAccountClaims & { sub: string };

type AuthCookie = {
    sub: string;
    iat: number;
} & Claims & {
    [key: string]: any; // Allow arbitrary optional properties
};

export type Auth = {
    isLoggedIn: false;
} | ({
    isLoggedIn: true;
    cookieToken?: string;
} & AuthCookie);

export type TokenPayload = OptionalStringClaims & OptionalAccountClaims & {
    iss: string;
    aud: string;
    nonce: string;
    jti: string;
    sub: string;
    scope: string[];
    iat: number;
    exp: number;
};

export type TokenHeader = {
    typ: string;
    alg: string;
};

export namespace Button {
  export type Color = "black" | "white"
  export type Theme = "ignore-light" | "ignore-dark" | "aware-invert" | "aware-static"
  export type Hover = "pop" | "glow" | "flare" | "none"
  export type UpdateScope = "email" | "picture" | "twitter" | "discord" | "github" | "gitlab"
  export const STYLES_URL = 'https://cdn.hello.coop/css/hello-btn.css'
  export const HOVER_MAPPING = {
      "pop": "",
      "glow": "hello-btn-hover-glow",
      "flare": "hello-btn-hover-flare",
      "none": "hello-btn-hover-none"
  }
  export const CLASS_MAPPING = {
      black: {
          "ignore-light": "",
          "ignore-dark": "hello-btn-black-on-dark",
          "aware-invert": "hello-btn-black-and-invert",
          "aware-static": "hello-btn-black-and-static"
      },
      white: {
          "ignore-light": "hello-btn-white-on-light",
          "ignore-dark": "hello-btn-white-on-dark",
          "aware-invert": "hello-btn-white-and-invert",
          "aware-static": "hello-btn-white-and-static"
      },
  }
  
}
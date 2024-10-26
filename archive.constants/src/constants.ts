import { Auth, AuthResponseMode, AuthResponseType, Scope } from "@hellocoop/definitions";

export const PRODUCTION_WALLET: string = 'https://wallet.hello.coop'

export const DEFAULT_SCOPE: Scope[] = ['openid','name','email','picture']
export const DEFAULT_RESPONSE_TYPE: AuthResponseType = 'code'
export const DEFAULT_RESPONSE_MODE: AuthResponseMode = 'query'
export const DEFAULT_PATH: string = '/authorize?'

export const VALID_IDENTITY_STRING_CLAIMS = [
    'name', 
    'nickname',
    'preferred_username',
    'given_name',
    'family_name',
    'email', 
    'phone', 
    'picture',
// Hellō extensions -- non-standard claims
    'ethereum',
] as const;

export const VALID_IDENTITY_ACCOUNT_CLAIMS = [
    'discord',
    'twitter',
    'github',
    'gitlab'
] as const

export const VALID_IDENTITY_CLAIMS = [
    ...VALID_IDENTITY_STRING_CLAIMS,
    ...VALID_IDENTITY_ACCOUNT_CLAIMS,
    'email_verified', 
    'phone_verified'
] as const;

export const VALID_SCOPES = [
    ...VALID_IDENTITY_STRING_CLAIMS,
    ...VALID_IDENTITY_ACCOUNT_CLAIMS,
    'profile',
    'openid', 
// Hellō extensions -- non-standard scopes
    'profile_update',
] as const;
export const VALID_RESPONSE_TYPE = ['id_token', 'code'] as const;    // Default: 'code'
export const VALID_RESPONSE_MODE = ['fragment', 'query', 'form_post'] // Default: 'query'
export const VALID_PROVIDER_HINT = [
    // 'google' and 'email' are always in default
    // 'apple' added if on Apple OS
    // 'microsoft' added if on Microsoft OS
    'apple', 
    'discord',
    'facebook',
    'github',
    'gitlab',
    'google',
    'twitch',
    'twitter',
    'tumblr',
    'mastodon',
    'microsoft',
    'line',
    'wordpress',
    'yahoo',
    'phone',
    'ethereum',
    'qrcode',
    // the following will remove provider from recommended list
    'apple--',
    'microsoft--',
    'google--',
    'email--',
    'passkey--',
] as const;

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

export const NotLoggedIn: Auth = { isLoggedIn: false}
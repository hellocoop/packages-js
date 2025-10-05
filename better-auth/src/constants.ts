import type { Scope } from '@hellocoop/definitions'

/**
 * Hellō OIDC discovery URL
 */
export const HELLO_DISCOVERY_URL =
    'https://issuer.hello.coop/.well-known/openid-configuration'

/**
 * Hellō issuer URL
 */
export const HELLO_ISSUER = 'https://issuer.hello.coop'

/**
 * Default scopes for Hellō authentication
 */
export const DEFAULT_HELLO_SCOPES: Scope[] = [
    'openid',
    'email',
    'name',
    'picture',
]

/**
 * All available Hellō scopes
 * See https://www.hello.dev/docs/scopes/ for details
 */
export const HELLO_SCOPES = {
    // Required
    OPENID: 'openid' as const,

    // Standard claims
    NAME: 'name' as const,
    NICKNAME: 'nickname' as const,
    GIVEN_NAME: 'given_name' as const,
    FAMILY_NAME: 'family_name' as const,
    EMAIL: 'email' as const,
    PHONE: 'phone' as const,
    PICTURE: 'picture' as const,
    PROFILE: 'profile' as const,
    PREFERRED_USERNAME: 'preferred_username' as const,

    // Social accounts (verified)
    DISCORD: 'discord' as const,
    GITHUB: 'github' as const,
    GITLAB: 'gitlab' as const,
    TWITTER: 'twitter' as const,

    // Other
    ETHEREUM: 'ethereum' as const,
    PROFILE_UPDATE: 'profile_update' as const,
} as const

/**
 * Valid provider hint values for Hellō
 */
export const HELLO_PROVIDERS = {
    APPLE: 'apple' as const,
    DISCORD: 'discord' as const,
    FACEBOOK: 'facebook' as const,
    GITHUB: 'github' as const,
    GITLAB: 'gitlab' as const,
    GOOGLE: 'google' as const,
    TWITCH: 'twitch' as const,
    TWITTER: 'twitter' as const,
    TUMBLR: 'tumblr' as const,
    MASTODON: 'mastodon' as const,
    MICROSOFT: 'microsoft' as const,
    LINE: 'line' as const,
    WORDPRESS: 'wordpress' as const,
    YAHOO: 'yahoo' as const,
    PHONE: 'phone' as const,
    ETHEREUM: 'ethereum' as const,
    QRCODE: 'qrcode' as const,
    // Demote defaults
    APPLE_DEMOTE: 'apple--' as const,
    MICROSOFT_DEMOTE: 'microsoft--' as const,
} as const

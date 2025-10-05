import { genericOAuth } from 'better-auth/plugins'
import type { Scope } from '@hellocoop/definitions'
import { HELLO_DISCOVERY_URL, DEFAULT_HELLO_SCOPES } from './constants'

export interface HelloProfile {
    sub: string
    email?: string
    email_verified?: boolean
    name?: string
    nickname?: string
    preferred_username?: string
    given_name?: string
    family_name?: string
    phone?: string
    phone_verified?: boolean
    picture?: string
    // Social accounts
    github?: { id: string; username: string }
    discord?: { id: string; username: string }
    gitlab?: { id: string; username: string }
    twitter?: { id: string; username: string }
    // Other
    ethereum?: string
    org?: { id: string; domain: string }
}

export interface HelloOptions {
    clientId: string
    scopes?: Scope[]
}

/**
 * Hellō OAuth Provider for Better Auth
 *
 * Integrates Hellō (https://hello.dev) as an OIDC provider for Better Auth.
 * Uses PKCE flow (no client secret required).
 *
 * @param options - Configuration options for the Hellō provider
 * @returns Better Auth genericOAuth plugin configured for Hellō
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth"
 * import { hellocoop } from "@hellocoop/better-auth"
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     hellocoop({
 *       clientId: process.env.HELLO_CLIENT_ID!,
 *       scopes: ["openid", "email", "name", "github"]
 *     })
 *   ]
 * })
 * ```
 */
export const hellocoop = (
    options: HelloOptions,
): ReturnType<typeof genericOAuth> => {
    const scopes = options.scopes || DEFAULT_HELLO_SCOPES
    // Ensure openid scope is always included
    const finalScopes = Array.from(new Set(['openid', ...scopes]))

    return genericOAuth({
        config: [
            {
                providerId: 'hellocoop',
                clientId: options.clientId,
                discoveryUrl: HELLO_DISCOVERY_URL,
                scopes: finalScopes as string[],
                pkce: true,
            },
        ],
    })
}

// Export types and constants
export * from './types'
export * from './constants'
export * from './button'

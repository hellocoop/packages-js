import type { Scope, ProviderHint } from '@hellocoop/definitions'

/**
 * Configuration options for the Hellō Better Auth plugin
 */
export interface HelloPluginConfig {
    /**
     * Your Hellō client ID from console.hello.coop
     */
    clientId: string

    /**
     * Optional scopes to request beyond the defaults (openid, email, name, picture)
     * See https://www.hello.dev/docs/scopes/ for available scopes
     */
    scopes?: Scope[]

    /**
     * Optional redirect URI (if different from Better Auth default)
     */
    redirectURI?: string

    /**
     * Default provider hint to customize recommended login providers
     * Examples: "github google", ["discord", "github"], "google--" (demote Google)
     */
    defaultProviderHint?: string | ProviderHint[]

    /**
     * Default domain hint to specify account type or domain
     * Examples: "hello.coop", "managed", "personal"
     */
    defaultDomainHint?: string

    /**
     * Default login hint (email or user sub) for which account to use
     * Examples: "user@example.com", "mailto:user@example.com", "sub_01234567..."
     */
    defaultLoginHint?: string

    /**
     * Default prompt value (space-delimited)
     * - "login": require re-authentication at login provider
     * - "consent": require user to review/change released claims
     * - "login consent": both
     */
    defaultPrompt?: string
}

/**
 * Options for signing in with Hellō (can override defaults)
 */
export interface HelloSignInOptions {
    /**
     * Override default provider hint
     */
    providerHint?: string | ProviderHint[]

    /**
     * Override default domain hint
     */
    domainHint?: string

    /**
     * Override default login hint
     */
    loginHint?: string

    /**
     * Override default prompt
     */
    prompt?: string

    /**
     * Callback URL after successful authentication
     */
    callbackURL?: string

    /**
     * Additional scopes to request for this sign-in
     */
    scopes?: Scope[]
}

/**
 * Hellō Better Auth Client Utilities
 *
 * Provides helper functions and constants for authenticating with Hellō from the client side.
 *
 * @example
 * ```typescript
 * import { createAuthClient } from "better-auth/client"
 * import { HELLO_SCOPES, HELLO_PROVIDERS } from "@hellocoop/better-auth/client"
 *
 * const authClient = createAuthClient({
 *   baseURL: "http://localhost:3000"
 * })
 *
 * // Sign in with Hellō
 * await authClient.signIn.social({
 *   provider: "hellocoop",
 *   callbackURL: "/dashboard"
 * })
 * ```
 */

// Re-export types and constants for client-side use
export type { HelloSignInOptions, HelloPluginConfig } from './types'
export { HELLO_SCOPES, HELLO_PROVIDERS } from './constants'

/**
 * Helper to build Hellō authorization URL with custom parameters
 * Use this if you need to add Hellō-specific parameters like provider_hint or domain_hint
 */
export const buildHelloAuthURL = (params: {
    clientId: string
    redirectUri: string
    scopes?: string[]
    providerHint?: string | string[]
    domainHint?: string
    loginHint?: string
    prompt?: string
    state?: string
    nonce?: string
}) => {
    const {
        clientId,
        redirectUri,
        scopes = ['openid', 'email', 'name', 'picture'],
        providerHint,
        domainHint,
        loginHint,
        prompt,
        state,
        nonce,
    } = params

    const urlParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        response_type: 'code',
        response_mode: 'query',
    })

    if (providerHint) {
        const hint = Array.isArray(providerHint)
            ? providerHint.join(' ')
            : providerHint
        urlParams.set('provider_hint', hint)
    }

    if (domainHint) {
        urlParams.set('domain_hint', domainHint)
    }

    if (loginHint) {
        urlParams.set('login_hint', loginHint)
    }

    if (prompt) {
        urlParams.set('prompt', prompt)
    }

    if (state) {
        urlParams.set('state', state)
    }

    if (nonce) {
        urlParams.set('nonce', nonce)
    }

    return `https://wallet.hello.coop/authorize?${urlParams.toString()}`
}

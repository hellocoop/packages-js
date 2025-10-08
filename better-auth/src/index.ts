import { betterFetch } from '@better-fetch/fetch'
import { APIError } from 'better-call'
import { decodeJwt } from 'jose'
import * as z from 'zod'
import { createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
// import { BASE_ERROR_CODES } from "../../error/codes";
import {
    createAuthorizationURL,
    validateAuthorizationCode,
} from 'better-auth/oauth2'
import type { OAuth2Tokens, OAuth2UserInfo, OAuthProvider } from 'better-auth'
import { handleOAuthUserInfo } from 'better-auth/oauth2'
import { generateState, parseState } from 'better-auth/oauth2'
import type {
    BetterAuthPlugin,
    GenericEndpointContext,
    User,
} from 'better-auth'
import { DISCOVERY_URL, PROVIDER_ID } from './constants'

// Export button and client
export { ContinueButton } from './button'
export { hellocoopClient } from './client'

/**
 * Configuration interface for generic OAuth providers.
 */
export interface GenericOAuthConfig {
    /** OAuth client ID */
    clientId: string
    /** OAuth client secret */
    clientSecret?: string
    /**
     * Array of OAuth scopes to request.
     * @default ["openid", "profile"]
     */
    scopes?: string[]
    /**
     * Custom redirect URI.
     * If not provided, a default URI will be constructed.
     */
    redirectURI?: string
    /**
     * OAuth response type.
     * @default "code"
     */
    responseType?: string
    /**
     * The response mode to use for the authorization code request.

     */
    responseMode?: 'query' | 'form_post'
    /**
     * Prompt parameter for the authorization request.
     * Controls the authentication experience for the user.
     */
    prompt?: 'login' | 'consent'
    /**
     * Whether to use PKCE (Proof Key for Code Exchange)
     * @default true
     */
    pkce?: boolean
    /**
     * URL for the authorization endpoint.
     */
    authorizationUrl?: string
    /**
     * URL for the token endpoint.
     */
    tokenUrl?: string
    /**
     * URL for the user info endpoint.
     */
    userInfoUrl?: string
    /**
     * Access type for the authorization request.
     * Use "offline" to request a refresh token.
     */
    accessType?: string
    /**
     * Custom function to fetch user info.
     * If provided, this function will be used instead of the default user info fetching logic.
     * @param tokens - The OAuth tokens received after successful authentication
     * @returns A promise that resolves to a User object or null
     */
    getUserInfo?: (tokens: OAuth2Tokens) => Promise<OAuth2UserInfo | null>
    /**
     * Custom function to map the user profile to a User object.
     */
    mapProfileToUser?: (
        profile: Record<string, any>,
    ) => Partial<Partial<User>> | Promise<Partial<User>>
    /**
     * Additional search-params to add to the authorizationUrl.
     * Warning: Search-params added here overwrite any default params.
     */
    authorizationUrlParams?:
        | Record<string, string>
        | ((ctx: GenericEndpointContext) => Record<string, string>)
    /**
     * Additional search-params to add to the tokenUrl.
     * Warning: Search-params added here overwrite any default params.
     */
    tokenUrlParams?:
        | Record<string, string>
        | ((ctx: GenericEndpointContext) => Record<string, string>)
    /**
     * Disable implicit sign up for new users. When set to true for the provider,
     * sign-in need to be called with with requestSignUp as true to create new users.
     */
    disableImplicitSignUp?: boolean
    /**
     * Disable sign up for new users.
     */
    disableSignUp?: boolean
    /**
     * Authentication method for token requests.
     * @default "post"
     */
    authentication?: 'basic' | 'post'
    /**
     * Override user info with the provider info.
     *
     * This will update the user info with the provider info,
     * when the user signs in with the provider.
     * @default true (for HelloCoop to ensure claims are updated)
     */
    overrideUserInfo?: boolean
    /**
     * URL to fetch OAuth 2.0 configuration.
     * If provided, the authorization and token endpoints will be fetched from this URL.
     */
    discoveryUrl?: string
    /**
     * Custom headers to include in the discovery request.
     * Useful for providers like Epic that require specific headers (e.g., Epic-Client-ID).
     */
    discoveryHeaders?: Record<string, string>
    /**
     * Custom headers to include in the authorization request.
     * Useful for providers like Qonto that require specific headers (e.g., X-Qonto-Staging-Token for local development).
     */
    authorizationHeaders?: Record<string, string>
    /**
     * Unique identifier for the OAuth provider
     */
    providerId?: string

    // Default values for signInWithHello parameters (can be overridden at runtime)
    /**
     * Default callback URL to redirect to after sign in.
     * Can be overridden in signInWithHello calls.
     * @default "/"
     */
    callbackURL?: string
    /**
     * Default error callback URL to redirect to if an error occurs.
     * Can be overridden in signInWithHello calls.
     * @default "/error"
     */
    errorCallbackURL?: string
    /**
     * Default login hint for which user account to use.
     * Can be overridden in signInWithHello calls.
     * @see https://www.hello.dev/docs/oidc/request/#openid-connect-parameters
     */
    loginHint?: string
    /**
     * Default provider hint - space separated list of preferred providers to show new users.
     * Can be overridden in signInWithHello calls.
     * @default "apple/microsoft" depending on OS and "google email"
     * @see https://www.hello.dev/docs/apis/wallet/#provider_hint
     */
    providerHint?: string
    /**
     * Default domain hint for which domain or type of account to use.
     * Can be overridden in signInWithHello calls.
     * @see https://www.hello.dev/docs/oidc/request/#hell%C5%8D-parameters
     */
    domainHint?: string
}

interface GenericOAuthOptions {
    /**
     * OAuth provider configuration for HelloCoop.
     */
    config: GenericOAuthConfig
}

async function getUserInfo(
    tokens: OAuth2Tokens,
    finalUserInfoUrl: string | undefined,
): Promise<OAuth2UserInfo | null> {
    if (tokens.idToken) {
        const decoded = decodeJwt(tokens.idToken) as {
            sub: string
            email_verified: boolean
            email: string
            name: string
            picture: string
        }
        if (decoded) {
            if (decoded.sub && decoded.email) {
                return {
                    id: decoded.sub,
                    emailVerified: decoded.email_verified,
                    image: decoded.picture,
                    ...decoded,
                }
            }
        }
    }

    if (!finalUserInfoUrl) {
        return null
    }

    const userInfo = await betterFetch<{
        email: string
        sub?: string
        name: string
        email_verified: boolean
        picture: string
    }>(finalUserInfoUrl, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
        },
    })
    return {
        // @ts-expect-error sub is optional in the type
        id: userInfo.data?.sub,
        emailVerified: userInfo.data?.email_verified ?? false,
        email: userInfo.data?.email,
        image: userInfo.data?.picture,
        name: userInfo.data?.name,
        ...userInfo.data,
    }
}

/**
 * A generic OAuth plugin that can be used to add OAuth support to any provider
 */
export const hellocoop = (options: GenericOAuthOptions) => {
    const ERROR_CODES = {
        INVALID_OAUTH_CONFIGURATION: 'Invalid OAuth configuration',
    } as const
    return {
        id: 'hellocoop',
        init: (ctx) => {
            const c = options.config
            let finalUserInfoUrl = c.userInfoUrl
            const provider = {
                id: PROVIDER_ID,
                name: PROVIDER_ID,
                createAuthorizationURL(data) {
                    return createAuthorizationURL({
                        id: PROVIDER_ID,
                        options: {
                            clientId: c.clientId,
                            clientSecret: c.clientSecret,
                            redirectURI: c.redirectURI,
                        },
                        authorizationEndpoint: c.authorizationUrl!,
                        state: data.state,
                        codeVerifier: c.pkce ? data.codeVerifier : undefined,
                        scopes: c.scopes || ['openid', 'profile'], // Default scope for HelloCoop
                        redirectURI: `${ctx.baseURL}/hellocoop/callback`,
                    })
                },
                async validateAuthorizationCode(data) {
                    let finalTokenUrl = c.tokenUrl
                    const discovery = await betterFetch<{
                        token_endpoint: string
                        userinfo_endpoint: string
                    }>(DISCOVERY_URL, {
                        method: 'GET',
                    })
                    if (discovery.data) {
                        finalTokenUrl = discovery.data.token_endpoint
                        finalUserInfoUrl = discovery.data.userinfo_endpoint
                    }
                    if (!finalTokenUrl) {
                        throw new APIError('BAD_REQUEST', {
                            message:
                                'Invalid OAuth configuration. Token URL not found.',
                        })
                    }
                    return validateAuthorizationCode({
                        code: data.code,
                        codeVerifier: data.codeVerifier,
                        redirectURI: data.redirectURI,
                        options: {
                            clientId: c.clientId,
                            clientSecret: c.clientSecret,
                            redirectURI: c.redirectURI,
                        },
                        tokenEndpoint: finalTokenUrl,
                        authentication: c.authentication,
                    })
                },
                async getUserInfo(tokens) {
                    const userInfo = c.getUserInfo
                        ? await c.getUserInfo(tokens)
                        : await getUserInfo(tokens, finalUserInfoUrl)
                    if (!userInfo) {
                        return null
                    }
                    return {
                        user: {
                            id: userInfo?.id,
                            email: userInfo?.email,
                            emailVerified: userInfo?.emailVerified,
                            image: userInfo?.image,
                            name: userInfo?.name,
                            ...c.mapProfileToUser?.(userInfo),
                        },
                        data: userInfo,
                    }
                },
            } as OAuthProvider
            return {
                context: {
                    socialProviders: [provider].concat(ctx.socialProviders),
                },
            }
        },
        endpoints: {
            /**
             * ### Endpoint
             *
             * POST `/sign-in/oauth2`
             *
             * ### API Methods
             *
             * **server:**
             * `auth.api.signInWithOAuth2`
             *
             * **client:**
             * `authClient.signIn.oauth2`
             *
             * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/sign-in#api-method-sign-in-oauth2)
             */
            hellocoopSignIn: createAuthEndpoint(
                '/hellocoop/sign-in',
                {
                    method: 'POST',
                    body: z.object({
                        callbackURL: z
                            .string()
                            .meta({
                                description:
                                    'The URL to redirect to after sign in',
                            })
                            .optional(),
                        errorCallbackURL: z
                            .string()
                            .meta({
                                description:
                                    'The URL to redirect to if an error occurs',
                            })
                            .optional(),
                        newUserCallbackURL: z
                            .string()
                            .meta({
                                description:
                                    'The URL to redirect to after login if the user is new. Eg: "/welcome"',
                            })
                            .optional(),
                        disableRedirect: z
                            .boolean()
                            .meta({
                                description: 'Disable redirect',
                            })
                            .optional(),
                        scopes: z
                            .array(z.string())
                            .meta({
                                description:
                                    'Scopes to be passed to the provider authorization request.',
                            })
                            .optional(),
                        requestSignUp: z
                            .boolean()
                            .meta({
                                description:
                                    'Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider. Eg: false',
                            })
                            .optional(),
                        prompt: z
                            .string()
                            .meta({
                                description:
                                    "OAuth prompt parameter (e.g., 'consent', 'login', 'select_account')",
                            })
                            .optional(),
                        providerHint: z
                            .string()
                            .meta({
                                description: 'Provider hint for the OAuth flow',
                            })
                            .optional(),
                        domainHint: z
                            .string()
                            .meta({
                                description: 'Domain hint for the OAuth flow',
                            })
                            .optional(),
                        loginHint: z
                            .string()
                            .meta({
                                description: 'Login hint for the OAuth flow',
                            })
                            .optional(),
                    }),
                    metadata: {
                        openapi: {
                            description: 'Sign in with OAuth2',
                            responses: {
                                200: {
                                    description: 'Sign in with OAuth2',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    url: {
                                                        type: 'string',
                                                    },
                                                    redirect: {
                                                        type: 'boolean',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                async (ctx) => {
                    // Since this is a HelloCoop-specific endpoint, we know the providerId is always "hellocoop"
                    const config = options.config
                    if (!config) {
                        throw new APIError('BAD_REQUEST', {
                            message: `No config found for provider hellocoop`,
                        })
                    }
                    const {
                        authorizationUrl,
                        tokenUrl,
                        clientId,
                        clientSecret,
                        scopes,
                        redirectURI,
                        responseType,
                        prompt,
                        accessType,
                        authorizationUrlParams,
                        responseMode,
                        // Default values from config that can be overridden by runtime parameters
                        callbackURL: defaultCallbackURL,
                        errorCallbackURL: defaultErrorCallbackURL,
                        providerHint: defaultProviderHint,
                        domainHint: defaultDomainHint,
                        loginHint: defaultLoginHint,
                    } = config
                    // PKCE is always enabled for HelloCoop for security
                    const pkce = true
                    let finalAuthUrl = authorizationUrl
                    let finalTokenUrl = tokenUrl
                    const discovery = await betterFetch<{
                        authorization_endpoint: string
                        token_endpoint: string
                    }>(DISCOVERY_URL, {
                        method: 'GET',
                        onError(context) {
                            ctx.context.logger.error(
                                context.error.message,
                                context.error,
                                {
                                    DISCOVERY_URL,
                                },
                            )
                        },
                    })
                    if (discovery.data) {
                        finalAuthUrl = discovery.data.authorization_endpoint
                        finalTokenUrl = discovery.data.token_endpoint
                    }
                    if (!finalAuthUrl || !finalTokenUrl) {
                        throw new APIError('BAD_REQUEST', {
                            message: ERROR_CODES.INVALID_OAUTH_CONFIGURATION,
                        })
                    }
                    if (authorizationUrlParams) {
                        const withAdditionalParams = new URL(finalAuthUrl)
                        for (const [paramName, paramValue] of Object.entries(
                            authorizationUrlParams,
                        )) {
                            withAdditionalParams.searchParams.set(
                                paramName,
                                paramValue,
                            )
                        }
                        finalAuthUrl = withAdditionalParams.toString()
                    }
                    const additionalParams =
                        typeof authorizationUrlParams === 'function'
                            ? authorizationUrlParams(ctx)
                            : authorizationUrlParams

                    // Merge config defaults with runtime parameters (runtime takes precedence)
                    const finalProviderHint =
                        ctx.body.providerHint ?? defaultProviderHint
                    const finalDomainHint =
                        ctx.body.domainHint ?? defaultDomainHint
                    const finalLoginHint =
                        ctx.body.loginHint ?? defaultLoginHint
                    const finalCallbackURL =
                        ctx.body.callbackURL ?? defaultCallbackURL
                    const finalErrorCallbackURL =
                        ctx.body.errorCallbackURL ?? defaultErrorCallbackURL
                    const finalPrompt = ctx.body.prompt ?? prompt // prompt can come from config or runtime

                    // Create a modified context with merged values for generateState
                    const modifiedCtx = {
                        ...ctx,
                        body: {
                            ...ctx.body,
                            callbackURL: finalCallbackURL,
                            errorCallbackURL: finalErrorCallbackURL,
                        },
                    }

                    const { state, codeVerifier } =
                        await generateState(modifiedCtx)
                    const authUrl = await createAuthorizationURL({
                        id: 'hellocoop',
                        options: {
                            clientId,
                            clientSecret,
                            redirectURI,
                        },
                        authorizationEndpoint: finalAuthUrl,
                        state,
                        codeVerifier: pkce ? codeVerifier : undefined,
                        scopes: ctx.body.scopes
                            ? [
                                  ...ctx.body.scopes,
                                  ...(scopes || ['openid', 'profile']),
                              ]
                            : scopes || ['openid', 'profile'], // Default scope for HelloCoop
                        redirectURI: `${ctx.context.baseURL}/hellocoop/callback`,
                        prompt: finalPrompt, // Use merged prompt value
                        accessType,
                        responseType,
                        responseMode,
                        additionalParams: {
                            ...additionalParams,
                            // Add HelloCoop-specific parameters (runtime overrides config defaults)
                            ...(finalProviderHint && {
                                provider_hint: finalProviderHint,
                            }),
                            ...(finalDomainHint && {
                                domain_hint: finalDomainHint,
                            }),
                            ...(finalLoginHint && {
                                login_hint: finalLoginHint,
                            }),
                        },
                    })
                    return ctx.json({
                        url: authUrl.toString(),
                        redirect: !ctx.body.disableRedirect,
                    })
                },
            ),
            oAuth2Callback: createAuthEndpoint(
                '/hellocoop/callback',
                {
                    method: 'GET',
                    query: z.object({
                        code: z
                            .string()
                            .meta({
                                description: 'The OAuth2 code',
                            })
                            .optional(),
                        error: z
                            .string()
                            .meta({
                                description: 'The error message, if any',
                            })
                            .optional(),
                        error_description: z
                            .string()
                            .meta({
                                description: 'The error description, if any',
                            })
                            .optional(),
                        state: z
                            .string()
                            .meta({
                                description:
                                    'The state parameter from the OAuth2 request',
                            })
                            .optional(),
                    }),
                    metadata: {
                        client: false,
                        openapi: {
                            description: 'OAuth2 callback',
                            responses: {
                                200: {
                                    description: 'OAuth2 callback',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    url: {
                                                        type: 'string',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                async (ctx) => {
                    const defaultErrorURL =
                        ctx.context.options.onAPIError?.errorURL ||
                        `${ctx.context.baseURL}/error`
                    if (ctx.query.error || !ctx.query.code) {
                        throw ctx.redirect(
                            `${defaultErrorURL}?error=${
                                ctx.query.error || 'oAuth_code_missing'
                            }&error_description=${ctx.query.error_description}`,
                        )
                    }
                    let tokens: OAuth2Tokens | undefined = undefined
                    const parsedState = await parseState(ctx)

                    const {
                        callbackURL,
                        codeVerifier,
                        errorURL,
                        requestSignUp,
                        newUserURL,
                        link,
                    } = parsedState
                    const code = ctx.query.code

                    const provider = options.config
                    if (!provider) {
                        throw new APIError('BAD_REQUEST', {
                            message: `No config found for provider hellocoop`,
                        })
                    }

                    function redirectOnError(error: string) {
                        const defaultErrorURL =
                            ctx.context.options.onAPIError?.errorURL ||
                            `${ctx.context.baseURL}/error`
                        let url = errorURL || defaultErrorURL
                        if (url.includes('?')) {
                            url = `${url}&error=${error}`
                        } else {
                            url = `${url}?error=${error}`
                        }
                        throw ctx.redirect(url)
                    }

                    let finalTokenUrl = provider.tokenUrl
                    let finalUserInfoUrl = provider.userInfoUrl
                    // Always use the HelloCoop discovery URL for this endpoint
                    const discovery = await betterFetch<{
                        token_endpoint: string
                        userinfo_endpoint: string
                    }>(DISCOVERY_URL, {
                        method: 'GET',
                        headers: provider.discoveryHeaders,
                    })
                    if (discovery.data) {
                        finalTokenUrl = discovery.data.token_endpoint
                        finalUserInfoUrl = discovery.data.userinfo_endpoint
                    }
                    try {
                        if (!finalTokenUrl) {
                            throw new APIError('BAD_REQUEST', {
                                message: 'Invalid OAuth configuration.',
                            })
                        }
                        const additionalParams =
                            typeof provider.tokenUrlParams === 'function'
                                ? provider.tokenUrlParams(ctx)
                                : provider.tokenUrlParams
                        tokens = await validateAuthorizationCode({
                            headers: provider.authorizationHeaders,
                            code,
                            codeVerifier: codeVerifier, // Always use codeVerifier for HelloCoop (PKCE is always enabled)
                            redirectURI: `${ctx.context.baseURL}/hellocoop/callback`,
                            options: {
                                clientId: provider.clientId,
                                clientSecret: provider.clientSecret,
                                redirectURI: provider.redirectURI,
                            },
                            tokenEndpoint: finalTokenUrl,
                            authentication: provider.authentication,
                            additionalParams,
                        })
                    } catch (e) {
                        ctx.context.logger.error(
                            e && typeof e === 'object' && 'name' in e
                                ? (e.name as string)
                                : '',
                            e,
                        )
                        throw redirectOnError('oauth_code_verification_failed')
                    }

                    if (!tokens) {
                        throw new APIError('BAD_REQUEST', {
                            message: 'Invalid OAuth configuration.',
                        })
                    }
                    const userInfo: Omit<User, 'createdAt' | 'updatedAt'> =
                        await (async function handleUserInfo() {
                            const userInfo = (
                                provider.getUserInfo
                                    ? await provider.getUserInfo(tokens)
                                    : await getUserInfo(
                                          tokens,
                                          finalUserInfoUrl,
                                      )
                            ) as OAuth2UserInfo | null
                            if (!userInfo) {
                                throw redirectOnError('user_info_is_missing')
                            }
                            const mapUser = provider.mapProfileToUser
                                ? await provider.mapProfileToUser(userInfo)
                                : userInfo
                            const email = mapUser.email
                                ? mapUser.email.toLowerCase()
                                : userInfo.email?.toLowerCase()
                            if (!email) {
                                ctx.context.logger.error(
                                    'Unable to get user info',
                                    userInfo,
                                )
                                throw redirectOnError('email_is_missing')
                            }
                            const id = mapUser.id
                                ? String(mapUser.id)
                                : String(userInfo.id)
                            const name = mapUser.name
                                ? mapUser.name
                                : userInfo.name
                            if (!name) {
                                ctx.context.logger.error(
                                    'Unable to get user info',
                                    userInfo,
                                )
                                throw redirectOnError('name_is_missing')
                            }
                            return {
                                ...userInfo,
                                ...mapUser,
                                email,
                                id,
                                name,
                            }
                        })()
                    if (link) {
                        if (
                            ctx.context.options.account?.accountLinking
                                ?.allowDifferentEmails !== true &&
                            link.email !== userInfo.email
                        ) {
                            return redirectOnError("email_doesn't_match")
                        }
                        const existingAccount =
                            await ctx.context.internalAdapter.findAccountByProviderId(
                                String(userInfo.id),
                                provider.providerId || PROVIDER_ID,
                            )
                        if (existingAccount) {
                            if (existingAccount.userId !== link.userId) {
                                return redirectOnError(
                                    'account_already_linked_to_different_user',
                                )
                            }
                            /* eslint-disable @typescript-eslint/no-unused-vars */
                            const updateData = Object.fromEntries(
                                Object.entries({
                                    accessToken: tokens.accessToken,
                                    idToken: tokens.idToken,
                                    accessTokenExpiresAt:
                                        tokens.accessTokenExpiresAt,
                                    scope: tokens.scopes?.join(','),
                                }).filter(
                                    ([_, value]) => value !== undefined,
                                ) as [string, any][],
                            )
                            await ctx.context.internalAdapter.updateAccount(
                                existingAccount.id,
                                updateData,
                            )
                        } else {
                            const newAccount =
                                await ctx.context.internalAdapter.createAccount(
                                    {
                                        userId: link.userId,
                                        providerId:
                                            provider.providerId || PROVIDER_ID,
                                        accountId: userInfo.id,
                                        accessToken: tokens.accessToken,
                                        accessTokenExpiresAt:
                                            tokens.accessTokenExpiresAt,
                                        scope: tokens.scopes?.join(','),
                                        idToken: tokens.idToken,
                                    },
                                )
                            if (!newAccount) {
                                return redirectOnError('unable_to_link_account')
                            }
                        }
                        let toRedirectTo: string
                        try {
                            const url = callbackURL
                            toRedirectTo = url.toString()
                        } catch {
                            toRedirectTo = callbackURL
                        }
                        throw ctx.redirect(toRedirectTo)
                    }

                    const result = await handleOAuthUserInfo(ctx, {
                        userInfo,
                        account: {
                            providerId: provider.providerId || PROVIDER_ID,
                            accountId: userInfo.id,
                            ...tokens,
                            scope: tokens.scopes?.join(','),
                        },
                        callbackURL: callbackURL,
                        disableSignUp:
                            (provider.disableImplicitSignUp &&
                                !requestSignUp) ||
                            provider.disableSignUp,
                        overrideUserInfo: provider.overrideUserInfo ?? true, // Default to true for HelloCoop to update user claims
                    })

                    if (result.error) {
                        return redirectOnError(
                            result.error.split(' ').join('_'),
                        )
                    }
                    const { session, user } = result.data!
                    await setSessionCookie(ctx, {
                        session,
                        user,
                    })
                    let toRedirectTo: string
                    try {
                        const url = result.isRegister
                            ? newUserURL || callbackURL
                            : callbackURL
                        toRedirectTo = url.toString()
                    } catch {
                        toRedirectTo = result.isRegister
                            ? newUserURL || callbackURL
                            : callbackURL
                    }
                    throw ctx.redirect(toRedirectTo)
                },
            ),
        },
        $ERROR_CODES: ERROR_CODES,
    } satisfies BetterAuthPlugin
}
